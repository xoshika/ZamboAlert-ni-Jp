#include <Arduino.h>
#include <SPI.h>
#include <LoRa.h>
#include <TinyGPSPlus.h>
#include <BLEDevice.h>
#include <BLEScan.h>
#include <BLEAdvertisedDevice.h>
#include "soc/soc.h"
#include "soc/rtc_cntl_reg.h"
#include "mesh_packet.h"
#include "config.h"

// =====================================================================
// ZamboAlert - Portable Rescuer Signal Pod
// ESP32 + SX1278 (LoRa) + NEO-6M (GPS) + BLE scan + buzzer + LED
// =====================================================================

// ---------- Pin defaults (override in config.h) ----------
#ifndef GPS_BAUD
#define GPS_BAUD 9600
#endif
#ifndef GPS_RX_PIN
#define GPS_RX_PIN 16
#endif
#ifndef GPS_TX_PIN
#define GPS_TX_PIN 17
#endif

#ifndef LORA_SCK_PIN
#define LORA_SCK_PIN 18
#endif
#ifndef LORA_MISO_PIN
#define LORA_MISO_PIN 19
#endif
#ifndef LORA_MOSI_PIN
#define LORA_MOSI_PIN 23
#endif
#ifndef LORA_NSS_PIN
#define LORA_NSS_PIN 5
#endif
#ifndef LORA_RST_PIN
#define LORA_RST_PIN 14
#endif
#ifndef LORA_DIO0_PIN
#define LORA_DIO0_PIN 26
#endif
#ifndef LORA_FREQ_HZ
#define LORA_FREQ_HZ 433E6
#endif
#ifndef LORA_TX_POWER_DBM
#define LORA_TX_POWER_DBM 17
#endif
#ifndef LORA_SF
#define LORA_SF 9
#endif
#ifndef LORA_BW_HZ
#define LORA_BW_HZ 125E3
#endif
#ifndef LORA_SYNC_WORD
#define LORA_SYNC_WORD 0x12
#endif

#ifndef BUZZER_PIN
#define BUZZER_PIN 25
#endif
#ifndef LED_PIN
#define LED_PIN 27
#endif

// How often this pod sends its own routine telemetry packet.
#ifndef TELEMETRY_INTERVAL_MS
#define TELEMETRY_INTERVAL_MS 10000
#endif
// How often to run a BLE scan for victim beacons.
#ifndef BLE_SCAN_INTERVAL_MS
#define BLE_SCAN_INTERVAL_MS 5000
#endif
#ifndef BLE_SCAN_DURATION_SEC
#define BLE_SCAN_DURATION_SEC 3
#endif
// The citizen app must advertise a BLE device name starting with this
// prefix for the pod to recognize it as an SOS beacon. Coordinate this
// string with whoever implements the Citizen role in the mobile app.
#ifndef VICTIM_BLE_NAME_PREFIX
#define VICTIM_BLE_NAME_PREFIX "ZA-SOS"
#endif
// RSSI threshold (dBm) at which the pod considers itself "close" to a
// victim and sounds the buzzer/LED. Less negative = closer.
#ifndef PROXIMITY_RSSI_THRESHOLD
#define PROXIMITY_RSSI_THRESHOLD -65
#endif
// Starting hop count for packets this pod originates.
#ifndef MESH_TTL
#define MESH_TTL 4
#endif

HardwareSerial GPSserial(2);
TinyGPSPlus gps;
BLEScan* bleScan = nullptr;
SeenFilter seenFilter;

uint32_t nodeId;
uint32_t txSeq = 0;

unsigned long lastGpsReport = 0;
unsigned long lastTelemetryTx = 0;
unsigned long lastBleScan = 0; // millis() of the last BLE scan START
unsigned long telemetryInterval = TELEMETRY_INTERVAL_MS;

// Latest BLE victim-scan summary, read by the telemetry packet builder.
// Written only from loop() context (processVictimScan), never from the BLE task.
int victimCount = 0;
int nearestVictimRssi = -127;
char nearestVictimId[9] = {0}; // 8 bytes + null terminator for local use
bool proximityActive = false;

// ---------- Non-blocking BLE scan state ----------
// bleScanDone is the ONLY thing the BLE task touches (set in onScanComplete).
// loop() reads and clears it, then processes the results itself.
volatile bool bleScanDone = false;
// True from a successful bleScan->start() until loop() has processed its
// results, so a new scan is never started while one is still in progress.
bool bleScanRunning = false;

// ---------- Pending relay queue (filled in handleLoraRx, drained in loop) ----------
// Holds received packets waiting out their random relay backoff, so the
// backoff no longer blocks loop() (and LoRa RX / GPS keep being serviced).
#define RELAY_QUEUE_SIZE 4
struct PendingRelay {
    MeshPacket pkt;
    unsigned long queuedAt;  // millis() when enqueued
    unsigned long backoffMs; // random jitter before retransmitting
    bool used;
};
PendingRelay relayQueue[RELAY_QUEUE_SIZE];

// Set by transmitPacket(). loop() allows at most one LoRa transmit per
// iteration, so one iteration never blocks longer than a single airtime.
bool txThisLoop = false;

const char* rssiQuality(int rssi) {
    if (rssi >= -50) return "Strong";
    if (rssi >= -70) return "Medium";
    return "Weak";
}

// =====================================================================
// GPS
// =====================================================================
void readGps() {
    while (GPSserial.available()) gps.encode(GPSserial.read());
}

void printGpsStatus() {
    Serial.println();
    Serial.println("---------- GPS ----------");
    if (gps.location.isValid()) {
        Serial.print("Lat: "); Serial.print(gps.location.lat(), 6);
        Serial.print("  Lng: "); Serial.println(gps.location.lng(), 6);
        Serial.print("Sats: ");
        Serial.println(gps.satellites.isValid() ? String(gps.satellites.value()) : "?");
    } else {
        Serial.println("Searching for fix...");
    }
    Serial.println("--------------------------");
}

// =====================================================================
// BLE victim-beacon scanning
// =====================================================================
class VictimBLECallbacks : public BLEAdvertisedDeviceCallbacks {
    void onResult(BLEAdvertisedDevice advertisedDevice) override {} // unused, we poll results after scan
};

// Runs in the BLE (Bluedroid) task when the scan duration ends. It must
// ONLY set the flag: no Serial, no LoRa, no touching scan results or the
// victim globals. loop() does all of that in processVictimScan().
void onScanComplete(BLEScanResults) {
    bleScanDone = true;
}

// Starts a BLE scan in the background and returns immediately (the old
// blocking start() froze loop() for BLE_SCAN_DURATION_SEC, so LoRa RX and
// GPS were not serviced during the scan).
void startVictimScan() {
    if (bleScan->start(BLE_SCAN_DURATION_SEC, onScanComplete, false)) {
        bleScanRunning = true;
    } else {
        Serial.println("[BLE] Scan start failed - retrying next interval.");
    }
}

// Called from loop() once onScanComplete() has fired.
void processVictimScan() {
    Serial.println();
    Serial.println("---------- BLE victim scan ----------");

    BLEScanResults results = bleScan->getResults();
    int count = results.getCount();

    victimCount = 0;
    nearestVictimRssi = -127;
    memset(nearestVictimId, 0, sizeof(nearestVictimId));

    for (int i = 0; i < count; i++) {
        BLEAdvertisedDevice device = results.getDevice(i);
        bool isSosBeacon = device.isAdvertisingService(BLEUUID(SOS_SERVICE_UUID));
        std::string name;
        if (device.haveName()) {
            name = device.getName();
            isSosBeacon = isSosBeacon || name.rfind(VICTIM_BLE_NAME_PREFIX, 0) == 0;
        }
        if (!isSosBeacon) continue;

        int rssi = device.getRSSI();
        victimCount++;
        if (rssi > nearestVictimRssi) {
            nearestVictimRssi = rssi;
            // BLE privacy addresses can rotate; this short ID is for the current scan only.
            std::string address = device.getAddress().toString();
            std::string suffix;
            for (size_t j = 0; j < address.length() && suffix.length() < 8; j++) {
                char c = address[j];
                if ((c >= '0' && c <= '9') || (c >= 'A' && c <= 'F') || (c >= 'a' && c <= 'f')) {
                    suffix += c;
                }
            }
            if (suffix.empty() && name.rfind(VICTIM_BLE_NAME_PREFIX, 0) == 0) {
                suffix = name.substr(strlen(VICTIM_BLE_NAME_PREFIX));
                if (!suffix.empty() && suffix[0] == '-') suffix = suffix.substr(1);
            }
            memset(nearestVictimId, 0, sizeof(nearestVictimId));
            strncpy(nearestVictimId, suffix.c_str(), 8);
        }

        Serial.print("  [VICTIM] ");
        Serial.print(name.empty() ? "ZamboAlert SOS service" : name.c_str());
        Serial.print("  RSSI=");
        Serial.print(rssi);
        Serial.print(" [");
        Serial.print(rssiQuality(rssi));
        Serial.println("]");
    }

    Serial.print("Victim beacons in range: ");
    Serial.println(victimCount);

    bleScan->clearResults();
    Serial.println("--------------------------------------");

    // Trigger proximity cue + immediate SOS relay packet on new detection.
    bool wasActive = proximityActive;
    proximityActive = (victimCount > 0 && nearestVictimRssi >= PROXIMITY_RSSI_THRESHOLD);
    digitalWrite(LED_PIN, proximityActive ? HIGH : LOW);
    if (BUZZER_PIN >= 0) digitalWrite(BUZZER_PIN, proximityActive ? HIGH : LOW);

    static unsigned long lastSosPacketTx = 0;
    if (victimCount > 0) {
        // Send an out-of-cycle SOS packet immediately on detection, and repeat every 5s while beacon is active
        if (!wasActive || (millis() - lastSosPacketTx >= 5000)) {
            lastSosPacketTx = millis();
            Serial.println("[BLE SOS] Active SOS beacon detected! Transmitting SOS via LoRa...");
            extern void sendPacket(uint8_t msgType);
            sendPacket(ZA_MSG_SOS);
        }
    }
}

void setupBle() {
    BLEDevice::init("ZamboAlert-Pod");
    bleScan = BLEDevice::getScan();
    bleScan->setAdvertisedDeviceCallbacks(new VictimBLECallbacks());
    bleScan->setActiveScan(true);   // active scan needed to reliably read device names
    bleScan->setInterval(100);
    bleScan->setWindow(80);
}

// =====================================================================
// LoRa
// =====================================================================
// SPI clock for the SX1278 (library default is 8 MHz).
#ifndef LORA_SPI_HZ
#define LORA_SPI_HZ 1E6
#endif
uint32_t sxSpiHz = LORA_SPI_HZ; // clock used by the raw sx* helpers below

bool setupLora() {
    SPI.begin(LORA_SCK_PIN, LORA_MISO_PIN, LORA_MOSI_PIN, LORA_NSS_PIN);
    LoRa.setPins(LORA_NSS_PIN, LORA_RST_PIN, LORA_DIO0_PIN);
    // The library defaults to 8 MHz SPI, which is marginal over breadboard
    // jumpers; the radio needs nowhere near that speed.
    LoRa.setSPIFrequency(LORA_SPI_HZ);
    if (!LoRa.begin(LORA_FREQ_HZ)) return false;

    LoRa.setSpreadingFactor(LORA_SF);
    LoRa.setSignalBandwidth(LORA_BW_HZ);
    LoRa.setCodingRate4(5);
    LoRa.setSyncWord(LORA_SYNC_WORD);
    LoRa.setTxPower(LORA_TX_POWER_DBM);
    LoRa.enableCrc();
    LoRa.receive();
    return true;
}

// ---------- Raw SX1278 register access (diagnostics + TX-done polling) ----------
// The LoRa library keeps readRegister() private, so these talk to the radio
// directly over the same SPI bus. Only called from loop() context.
#define SX_REG_OP_MODE   0x01
#define SX_REG_IRQ_FLAGS 0x12
#define SX_REG_VERSION   0x42
#define SX_IRQ_TX_DONE   0x08

uint8_t sxTransfer(uint8_t addr, uint8_t value) {
    SPI.beginTransaction(SPISettings(sxSpiHz, MSBFIRST, SPI_MODE0));
    digitalWrite(LORA_NSS_PIN, LOW);
    SPI.transfer(addr);
    uint8_t out = SPI.transfer(value);
    digitalWrite(LORA_NSS_PIN, HIGH);
    SPI.endTransaction();
    return out;
}
uint8_t sxRead(uint8_t reg) { return sxTransfer(reg & 0x7F, 0x00); }
void sxWrite(uint8_t reg, uint8_t value) { sxTransfer(reg | 0x80, value); }

void printRadioState(const char* when) {
    uint8_t op = sxRead(SX_REG_OP_MODE);
    uint8_t irq = sxRead(SX_REG_IRQ_FLAGS);
    uint8_t ver = sxRead(SX_REG_VERSION);
    Serial.print("[LoRa DIAG] "); Serial.print(when);
    Serial.print(": RegOpMode=0x"); Serial.print(op, HEX);
    Serial.print(" RegIrqFlags=0x"); Serial.print(irq, HEX);
    Serial.print(" RegVersion=0x"); Serial.print(ver, HEX);
    if (ver != 0x12) {
        Serial.print("  <- radio not answering on SPI (expected 0x12): power or wiring");
    } else if (!(op & 0x80)) {
        Serial.print("  <- radio fell out of LoRa mode: it reset (power dip during TX)");
    } else if ((op & 0x07) == 0x03) {
        Serial.print("  <- stuck in TX mode, TX-done never raised");
    }
    Serial.println();
}

// Boot-time radio check, printed once. Separates the two possible causes of
// a failed transmit:
//  1. SPI write/read errors (wiring / clock speed): counted by writing
//     patterns to a scratch register and reading them back.
//  2. The radio cannot power its transmit chain: checked by stepping
//     standby -> FSTX (synthesiser on, no RF output) and reading the mode back.
int sxPatternErrors(uint32_t hz) {
    static const uint8_t patterns[] = {0x00, 0xFF, 0x55, 0xAA, 0x01, 0x02, 0x03, 0x80, 0x81, 0x83, 0x24};
    sxSpiHz = hz;
    int errors = 0;
    for (int round = 0; round < 50; round++) {
        for (uint8_t v : patterns) {
            sxWrite(0x22, v);                 // RegPayloadLength: harmless scratch
            if (sxRead(0x22) != v) errors++;
        }
    }
    sxSpiHz = LORA_SPI_HZ;
    return errors;
}

// Checks that the radio is really powered from its 3.3V pin. A chip whose
// supply wire is missing can still run from current leaking in through the
// GPIO lines the ESP32 holds HIGH (NSS, RST): SPI works, but it cannot
// transmit. Here every line to the radio is released for a second; a chip
// with a real supply keeps its registers, a leak-powered one forgets them.
void radioSupplyTest(unsigned long releaseMs) {
    sxWrite(SX_REG_OP_MODE, 0x81); delay(10);
    sxWrite(0x22, 0xA5);                       // marker in RegPayloadLength
    sxWrite(0x39, 0x5C);                       // marker in RegSyncWord
    SPI.end();
    pinMode(LORA_SCK_PIN, INPUT_PULLDOWN);
    pinMode(LORA_MOSI_PIN, INPUT_PULLDOWN);
    pinMode(LORA_NSS_PIN, INPUT_PULLDOWN);
    pinMode(LORA_RST_PIN, INPUT);              // floating: chip's own pull-up holds it
    delay(releaseMs);
    pinMode(LORA_RST_PIN, OUTPUT); digitalWrite(LORA_RST_PIN, HIGH);
    pinMode(LORA_NSS_PIN, OUTPUT); digitalWrite(LORA_NSS_PIN, HIGH);
    SPI.begin(LORA_SCK_PIN, LORA_MISO_PIN, LORA_MOSI_PIN, LORA_NSS_PIN);
    delay(20);
    uint8_t op = sxRead(SX_REG_OP_MODE), len = sxRead(0x22), sync = sxRead(0x39);
    bool kept = (op == 0x81 && len == 0xA5 && sync == 0x5C);
    Serial.print("Supply test (lines released "); Serial.print(releaseMs);
    Serial.print(" ms): op=0x"); Serial.print(op, HEX);
    Serial.print(" marker1=0x"); Serial.print(len, HEX);
    Serial.print(" marker2=0x"); Serial.print(sync, HEX);
    Serial.println(kept ? "  -> registers kept: radio has its own 3.3V supply"
                        : "  -> registers LOST: radio is NOT powered from its 3.3V pin (check 3V3/GND wires)");
    if (!kept) { LoRa.end(); setupLora(); } else { sxWrite(0x39, LORA_SYNC_WORD); }
}

void radioSelfTest() {
    Serial.println("---------- Radio self-test ----------");
    radioSupplyTest(1);    // control: same pin shuffle, no time to lose power
    radioSupplyTest(1500);
    sxWrite(SX_REG_OP_MODE, 0x81); delay(10); // LoRa standby
    Serial.print("SPI errors /550 @8MHz: "); Serial.print(sxPatternErrors(8E6));
    Serial.print("   @1MHz: "); Serial.print(sxPatternErrors(1E6));
    Serial.print("   @100kHz: "); Serial.println(sxPatternErrors(100E3));

    sxWrite(SX_REG_OP_MODE, 0x81); delay(10);
    uint8_t stdby = sxRead(SX_REG_OP_MODE);
    sxWrite(SX_REG_OP_MODE, 0x82); delay(10); // FSTX: synthesiser only, no RF out
    uint8_t fstx = sxRead(SX_REG_OP_MODE);
    delay(200);
    uint8_t fstxLater = sxRead(SX_REG_OP_MODE);
    sxWrite(SX_REG_OP_MODE, 0x81); delay(10);
    Serial.print("Mode readback: standby=0x"); Serial.print(stdby, HEX);
    Serial.print(" (want 81)  FSTX=0x"); Serial.print(fstx, HEX);
    Serial.print(" then 0x"); Serial.print(fstxLater, HEX);
    Serial.println(" (want 82 82)");
    Serial.println("-------------------------------------");
    LoRa.receive();
}

// Longest we wait for the radio to report "transmit done". A 36-byte packet
// at SF9/125 kHz is ~330 ms on air, so this is a generous margin.
#ifndef LORA_TX_TIMEOUT_MS
#define LORA_TX_TIMEOUT_MS 1500
#endif

unsigned long txFailCount = 0;

// Returns true if the packet went out. Never blocks longer than
// LORA_TX_TIMEOUT_MS: the library's blocking endPacket() waits for TX-done
// forever, which froze loop() whenever the radio failed to transmit.
bool transmitPacket(const MeshPacket& pkt) {
    txThisLoop = true; // loop() allows only one transmit per iteration
    uint8_t buf[sizeof(MeshPacket)];
    encodePacket(pkt, buf);

    if (!LoRa.beginPacket()) {
        Serial.println("[LoRa TX] beginPacket() refused - radio still reports TX mode.");
        printRadioState("beginPacket refused");
    }
    LoRa.write(buf, sizeof(buf));
    // Trace for the failure report: mode before TX, payload length the radio
    // holds, and how long it actually stays in TX mode (0x83).
    const uint8_t opBefore = sxRead(SX_REG_OP_MODE);  // expect 0x81 (standby)
    const uint8_t payloadLen = sxRead(0x22);          // expect 36
    LoRa.endPacket(true); // async: start the transmit, then poll with a timeout
    const uint8_t opAtStart = sxRead(SX_REG_OP_MODE); // expect 0x83 (TX)

    const unsigned long start = millis();
    bool done = false;
    bool sawTx = (opAtStart == 0x83);
    long leftTxAtMs = -1;      // when the radio left TX mode without TX-done
    uint8_t leftTxTo = 0;
    while (millis() - start < LORA_TX_TIMEOUT_MS) {
        if (sxRead(SX_REG_IRQ_FLAGS) & SX_IRQ_TX_DONE) { done = true; break; }
        uint8_t op = sxRead(SX_REG_OP_MODE);
        if (op == 0x83) sawTx = true;
        else if (leftTxAtMs < 0) { leftTxAtMs = (long)(millis() - start); leftTxTo = op; }
        delay(2);
    }

    if (done) {
        sxWrite(SX_REG_IRQ_FLAGS, SX_IRQ_TX_DONE); // clear the flag
        LoRa.receive();
        Serial.print("[LoRa TX] sent in ");
        Serial.print(millis() - start);
        Serial.println(" ms");
        return true;
    }

    txFailCount++;
    Serial.print("[LoRa TX] FAILED - no TX-done after ");
    Serial.print(LORA_TX_TIMEOUT_MS);
    Serial.print(" ms (failure #"); Serial.print(txFailCount); Serial.println(")");
    printRadioState("at timeout");
    Serial.print("[LoRa DIAG] trace: opBeforeTx=0x"); Serial.print(opBefore, HEX);
    Serial.print(" payloadLen="); Serial.print(payloadLen);
    Serial.print(" opAfterTxCmd=0x"); Serial.print(opAtStart, HEX);
    Serial.print(" enteredTx="); Serial.print(sawTx ? "yes" : "NO");
    Serial.print(" leftTxAfter="); Serial.print(leftTxAtMs);
    Serial.print("ms to 0x"); Serial.print(leftTxTo, HEX);
    Serial.print(" RegPaConfig=0x"); Serial.print(sxRead(0x09), HEX);
    Serial.print(" RegOcp=0x"); Serial.println(sxRead(0x0B), HEX);

    // Recover: hardware-reset and reconfigure the radio so the pod keeps
    // running (BLE scan, GPS, relaying) and the next send can try again.
    LoRa.end();
    bool ok = setupLora();
    Serial.println(ok ? "[LoRa TX] radio re-initialised." : "[LoRa TX] radio re-init FAILED (SX1278 not responding).");
    printRadioState("after re-init");
    return false;
}

// Builds and sends this pod's own telemetry/SOS packet.
void sendPacket(uint8_t msgType) {
    MeshPacket pkt;
    pkt.magic = ZA_MAGIC;
    pkt.msgType = msgType;
    pkt.nodeId = nodeId;
    pkt.seq = txSeq++;

    bool fix = gps.location.isValid() && gps.location.age() <= 10000UL;
    pkt.gpsFix = fix ? 1 : 0;
    pkt.lat_e6 = fix ? (int32_t)(gps.location.lat() * 1e6) : 0;
    pkt.lng_e6 = fix ? (int32_t)(gps.location.lng() * 1e6) : 0;
    pkt.sats = gps.satellites.isValid() ? (uint8_t)gps.satellites.value() : 0;

#if GPS_INDOOR_TEST_FALLBACK
    if (!fix) {
        pkt.gpsFix = 1;
        pkt.lat_e6 = (int32_t)(FALLBACK_LAT * 1e6);
        pkt.lng_e6 = (int32_t)(FALLBACK_LNG * 1e6);
        pkt.sats = 0; // indicates indoor fallback coordinates
    }
#endif

    pkt.bleVictims = (uint8_t)victimCount;
    pkt.nearestRssi = (int8_t)nearestVictimRssi;
    memset(pkt.victimId, 0, sizeof(pkt.victimId));
    memcpy(pkt.victimId, nearestVictimId, sizeof(pkt.victimId));
    pkt.victimStatus = ZA_STATUS_UNCLASSIFIED; // set by rescuer app, not firmware
    pkt.hopCount = MESH_TTL;
    pkt.uptimeSec = millis() / 1000;

    bool sent = transmitPacket(pkt);
    seenFilter.seenBefore(pkt.nodeId, pkt.seq); // mark our own packet as seen so we never re-relay it

    Serial.println();
    Serial.print(msgType == ZA_MSG_SOS ? "[LoRa TX: SOS] " : "[LoRa TX: telemetry] ");
    if (!sent) Serial.print("NOT SENT ");
    Serial.print("seq="); Serial.print(pkt.seq);
    Serial.print(" fix="); Serial.print(pkt.gpsFix);
    Serial.print(" victims="); Serial.print(pkt.bleVictims);
    if (pkt.victimId[0] != 0) {
        char idBuf[9] = {0};
        memcpy(idBuf, pkt.victimId, 8);
        Serial.print(" nearestId="); Serial.println(idBuf);
    } else {
        Serial.println();
    }
}

// Relays a packet this pod received from another node, after a short
// random backoff (reduces collisions when several pods hear the same
// transmission and all try to relay it at once).
// The backoff is non-blocking: the packet is queued here and sent by
// serviceRelayQueue() from loop() once its backoff has elapsed.
void relayPacket(MeshPacket pkt) {
    if (pkt.hopCount == 0) return; // TTL expired, drop silently
    pkt.hopCount--;

    for (int i = 0; i < RELAY_QUEUE_SIZE; i++) {
        if (!relayQueue[i].used) {
            relayQueue[i].pkt = pkt;
            relayQueue[i].queuedAt = millis();
            relayQueue[i].backoffMs = random(50, 400); // small jittered backoff before retransmitting
            relayQueue[i].used = true;
            return;
        }
    }

    Serial.print("[LoRa RELAY] queue full, dropped node=");
    Serial.print(pkt.nodeId, HEX);
    Serial.print(" seq="); Serial.println(pkt.seq);
}

// Transmits at most one queued relay whose backoff has elapsed.
// Returns true if it transmitted.
bool serviceRelayQueue() {
    const unsigned long now = millis();
    for (int i = 0; i < RELAY_QUEUE_SIZE; i++) {
        if (!relayQueue[i].used) continue;
        // Unsigned subtraction: safe across millis() wraparound.
        if (now - relayQueue[i].queuedAt < relayQueue[i].backoffMs) continue;

        MeshPacket pkt = relayQueue[i].pkt;
        relayQueue[i].used = false;
        bool sent = transmitPacket(pkt);

        Serial.print(sent ? "[LoRa RELAY] from node=" : "[LoRa RELAY] NOT SENT from node=");
        Serial.print(pkt.nodeId, HEX);
        Serial.print(" seq="); Serial.print(pkt.seq);
        Serial.print(" hopsLeft="); Serial.println(pkt.hopCount);
        return true;
    }
    return false;
}

void handleLoraRx() {
    int packetSize = LoRa.parsePacket();
    if (packetSize > 0) {
        uint8_t data[sizeof(MeshPacket)];
        int len = 0;
        while (LoRa.available() && len < (int)sizeof(data)) {
            data[len++] = (uint8_t)LoRa.read();
        }
        while (LoRa.available()) LoRa.read();
        // parsePacket() left the radio in standby after a packet; re-arm
        // reception now, before logging/queuing, so it listens meanwhile.
        LoRa.receive();

        MeshPacket pkt;
        if (decodePacket(data, len, pkt)) {
            if (pkt.nodeId != nodeId && !seenFilter.seenBefore(pkt.nodeId, pkt.seq)) {
                Serial.println();
                Serial.print("[LoRa RX] from node=");
                Serial.print(pkt.nodeId, HEX);
                Serial.print(" seq="); Serial.print(pkt.seq);
                Serial.print(" type="); Serial.println(pkt.msgType == ZA_MSG_SOS ? "SOS" : "telemetry");
                relayPacket(pkt);
            }
        }
    }
}

// =====================================================================

void setup() {
    WRITE_PERI_REG(RTC_CNTL_BROWN_OUT_REG, 0); // Disable brownout detector to prevent reboot during radio current surges
    Serial.begin(115200);
    delay(1000);

    // getEfuseMac() puts mac[0] in the low byte, so its low 32 bits are the
    // 3 vendor (OUI) bytes + mac[3] and collide across boards from one batch.
    // Shift out the OUI to use mac[2..5], the board-unique bytes.
    nodeId = (uint32_t)(ESP.getEfuseMac() >> 16);
    // Random starting seq so other pods' SeenFilter doesn't drop our first
    // packets after a reboot. Must run before setupBle()/loop() can send.
    txSeq = esp_random();

    Serial.println();
    Serial.println("========================================");
    Serial.println("   ZAMBOALERT - PORTABLE RESCUER SIGNAL POD");
    Serial.println("========================================");
    Serial.print("Node ID: "); Serial.println(nodeId, HEX);
    Serial.println();

    // Larger RX buffer so GPS bytes survive a ~300 ms LoRa transmit (the
    // default 256 bytes is only ~0.27 s at 9600 baud). Must precede begin().
    GPSserial.setRxBufferSize(1024);
    GPSserial.begin(GPS_BAUD, SERIAL_8N1, GPS_RX_PIN, GPS_TX_PIN);
    Serial.println("GPS UART started.");

    pinMode(LED_PIN, OUTPUT);
    digitalWrite(LED_PIN, LOW);
    if (BUZZER_PIN >= 0) {
        pinMode(BUZZER_PIN, OUTPUT);
        digitalWrite(BUZZER_PIN, LOW);
    }

    seenFilter.init();
    if (!setupLora()) {
        Serial.println("LoRa init FAILED - check SX1278 wiring/power. Halting.");
        while (true) delay(1000);
    }
    Serial.println("LoRa mesh radio ready.");
    radioSelfTest();

    setupBle();
    Serial.print("BLE scanning for victim beacons (UUID: ");
    Serial.print(SOS_SERVICE_UUID);
    Serial.print(" or prefix \"");
    Serial.print(VICTIM_BLE_NAME_PREFIX);
    Serial.println("*\").");

    Serial.println();
    Serial.println("Wiring:");
    Serial.println("GPS    -> 3V3/GND, TX->GPIO16, RX->GPIO17");
    Serial.print("SX1278 -> 3V3/GND, SCK"); Serial.print(LORA_SCK_PIN);
    Serial.print(" MISO"); Serial.print(LORA_MISO_PIN);
    Serial.print(" MOSI"); Serial.print(LORA_MOSI_PIN);
    Serial.print(" NSS"); Serial.print(LORA_NSS_PIN);
    Serial.print(" RST"); Serial.print(LORA_RST_PIN);
    Serial.print(" DIO0 "); Serial.println(LORA_DIO0_PIN);
    Serial.print("Buzzer -> GPIO"); Serial.println(BUZZER_PIN);
    Serial.print("LED    -> GPIO"); Serial.println(LED_PIN);
    Serial.println("Interactive testing: Type 's' in Serial to trigger test SOS, 't' for telemetry.");
}

void loop() {
    // Nothing in loop() may block except a single LoRa transmit (~270 ms
    // airtime at SF9/125k). LoRa.parsePacket() uses single-RX mode, which
    // drops to standby after its symbol timeout and is only re-armed by the
    // next poll, so loop() has to come round quickly.
    txThisLoop = false;
    readGps();
    const unsigned long now = millis();

    // Poll LoRa first, so a packet that just finished arriving is read out
    // of the FIFO before any transmit below overwrites it.
    handleLoraRx();

    // Check for interactive Serial test commands
    if (Serial.available()) {
        char ch = Serial.read();
        if (ch == 's' || ch == 'S') {
            Serial.println("[TEST] Manual SOS triggered via Serial input!");
            sendPacket(ZA_MSG_SOS);
        } else if (ch == 't' || ch == 'T') {
            Serial.println("[TEST] Manual Telemetry triggered via Serial input!");
            sendPacket(ZA_MSG_TELEMETRY);
        }
    }

    if (now - lastGpsReport >= 30000) {
        lastGpsReport = now;
        printGpsStatus();
    }

    // BLE scan finished (flag set in the BLE task): process the results here,
    // in loop() context. Deferred while another transmit already happened this
    // iteration, because processing may send an out-of-cycle SOS packet.
    if (bleScanDone && !txThisLoop) {
        bleScanDone = false;
        bleScanRunning = false;
        processVictimScan();
    }

    // Watchdog: if the scan-complete callback never arrives, stop the scan
    // and let the next interval start a fresh one (otherwise scanning would
    // stay stuck forever).
    if (bleScanRunning && !bleScanDone &&
        now - lastBleScan >= (unsigned long)BLE_SCAN_DURATION_SEC * 1000UL + 5000UL) {
        Serial.println("[BLE] Scan did not complete - restarting scanner.");
        bleScan->stop();
        bleScan->clearResults();
        bleScanRunning = false;
        lastBleScan = now;
    }

    // Start the next scan BLE_SCAN_INTERVAL_MS after the previous start, but
    // never while one is running or its results are still unprocessed
    // (start() would discard them).
    if (!bleScanRunning && !bleScanDone && now - lastBleScan >= BLE_SCAN_INTERVAL_MS) {
        lastBleScan = now;
        startVictimScan();
    }

    // Relays whose backoff has elapsed (one per iteration).
    if (!txThisLoop) {
        serviceRelayQueue();
    }

    // Routine telemetry; if something else transmitted this iteration it is
    // simply sent on the next one (lastTelemetryTx is not updated here).
    if (!txThisLoop && (uint32_t)(now - lastTelemetryTx) >= telemetryInterval) {
        lastTelemetryTx = now;
        telemetryInterval = TELEMETRY_INTERVAL_MS + random(0, 1500); // jitter to avoid synchronized transmissions
        sendPacket(victimCount > 0 ? ZA_MSG_SOS : ZA_MSG_TELEMETRY);
    }

    delay(1); // keep short: the single-RX re-arm gap is at most one loop iteration
}
