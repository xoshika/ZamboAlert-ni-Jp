#include <Arduino.h>
#include <SPI.h>
#include <LoRa.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <PubSubClient.h>
#include "mesh_packet.h"
#include "config.h"

// =====================================================================
// ZamboAlert - Static Barangay Gateway Node
// ESP32 + SX1278 (LoRa) only - fixed install, surveyed coordinates,
// no onboard GPS (per project spec).
// Forwards every decoded packet over UART (always) and, if configured,
// over Wi-Fi via HTTP POST and/or MQTT publish to the Barangay Local
// Server.
// =====================================================================

// ---------- LoRa pins/radio settings (must match the pods) ----------
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
#ifndef LORA_SF
#define LORA_SF 9
#endif
#ifndef LORA_BW_HZ
#define LORA_BW_HZ 125E3
#endif
#ifndef LORA_SYNC_WORD
#define LORA_SYNC_WORD 0x12
#endif

// ---------- Fixed, surveyed gateway coordinates (set once, by hand) ----------
#ifndef GATEWAY_LAT
#define GATEWAY_LAT 6.912345   // <-- replace with the barangay hall's surveyed latitude
#endif
#ifndef GATEWAY_LNG
#define GATEWAY_LNG 122.079876 // <-- replace with the barangay hall's surveyed longitude
#endif

// ---------- Forwarding toggles ----------
// Flip these in config.h. UART is always on (it's just Serial, already
// used for debug output); HTTP/MQTT are optional and independent.
#ifndef FORWARD_VIA_HTTP
#define FORWARD_VIA_HTTP 0
#endif
#ifndef FORWARD_VIA_MQTT
#define FORWARD_VIA_MQTT 0
#endif

#ifndef WIFI_SSID
#define WIFI_SSID "CHANGE_ME"
#endif
#ifndef WIFI_PASSWORD
#define WIFI_PASSWORD "CHANGE_ME"
#endif
#ifndef SERVER_URL
#define SERVER_URL "http://192.168.1.100:3000/api/telemetry"
#endif
#ifndef GATEWAY_API_KEY
#define GATEWAY_API_KEY "CHANGE_ME"
#endif
#ifndef MQTT_BROKER_HOST
#define MQTT_BROKER_HOST "192.168.1.100"
#endif
#ifndef MQTT_BROKER_PORT
#define MQTT_BROKER_PORT 1883
#endif
#ifndef MQTT_TOPIC
#define MQTT_TOPIC "zamboalert/telemetry"
#endif
#ifndef WIFI_RECONNECT_INTERVAL_MS
#define WIFI_RECONNECT_INTERVAL_MS 10000
#endif

// ---------- HTTP forward timing ----------
// Short timeouts so a slow/down backend can't stall the loop for long,
// and a backoff window after a connection-level failure so we don't
// spend ~1.5 s per packet retrying a dead server.
#ifndef HTTP_CONNECT_TIMEOUT_MS
#define HTTP_CONNECT_TIMEOUT_MS 1500
#endif
#ifndef HTTP_TIMEOUT_MS
#define HTTP_TIMEOUT_MS 2000
#endif
#ifndef HTTP_BACKOFF_MS
#define HTTP_BACKOFF_MS 10000
#endif

String gatewayId;
unsigned long rxCount = 0;
unsigned long lastWifiAttempt = 0;

// Duplicate filter: the same pod packet can arrive several times via
// different relay pods. Only the first copy is printed/forwarded.
SeenFilter seenFilter;

// HTTP backoff state (set after a failure with code <= 0).
bool httpBackoffActive = false;
unsigned long httpBackoffStart = 0;

WiFiClient wifiClient;
PubSubClient mqttClient(wifiClient);

const char* rssiQuality(int rssi) {
    if (rssi >= -50) return "Strong";
    if (rssi >= -70) return "Medium";
    return "Weak";
}

bool setupLora() {
    SPI.begin(LORA_SCK_PIN, LORA_MISO_PIN, LORA_MOSI_PIN, LORA_NSS_PIN);
    LoRa.setPins(LORA_NSS_PIN, LORA_RST_PIN, LORA_DIO0_PIN);
    if (!LoRa.begin(LORA_FREQ_HZ)) return false;

    LoRa.setSpreadingFactor(LORA_SF);
    LoRa.setSignalBandwidth(LORA_BW_HZ);
    LoRa.setCodingRate4(5);
    LoRa.setSyncWord(LORA_SYNC_WORD);
    LoRa.enableCrc();
    LoRa.receive();
    return true;
}

#if FORWARD_VIA_HTTP || FORWARD_VIA_MQTT
void connectWifi() {
    Serial.print("Connecting to WiFi '");
    Serial.print(WIFI_SSID);
    Serial.print("' ");
    WiFi.mode(WIFI_STA);
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

    unsigned long start = millis();
    while (WiFi.status() != WL_CONNECTED && millis() - start < 10000) {
        Serial.print(".");
        delay(300);
    }
    Serial.println();
    if (WiFi.status() == WL_CONNECTED) {
        Serial.print("WiFi connected. IP: ");
        Serial.println(WiFi.localIP());
    } else {
        Serial.println("WiFi connect failed (will retry in background).");
    }
}

void maintainWifi() {
    if (WiFi.status() == WL_CONNECTED) return;
    unsigned long now = millis();
    if (now - lastWifiAttempt < WIFI_RECONNECT_INTERVAL_MS) return;
    lastWifiAttempt = now;
    Serial.println("WiFi not connected, retrying...");
    WiFi.disconnect();
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
}
#endif

#if FORWARD_VIA_MQTT
void maintainMqtt() {
    if (WiFi.status() != WL_CONNECTED) return;
    if (mqttClient.connected()) { mqttClient.loop(); return; }

    Serial.print("Connecting to MQTT broker ");
    Serial.print(MQTT_BROKER_HOST);
    Serial.print("... ");
    if (mqttClient.connect(gatewayId.c_str())) {
        Serial.println("connected.");
    } else {
        Serial.print("failed, rc=");
        Serial.println(mqttClient.state());
    }
}
#endif

// Pulls the 8-byte raw victimId field into a safe, printable string.
// Not guaranteed null-terminated on the wire, and could in principle
// contain characters that break JSON if a phone advertises a weird
// name, so anything non-alphanumeric is replaced with '_'.
void sanitizeVictimId(const char* raw, char* out, size_t outLen) {
    size_t n = 0;
    for (; n < 8 && n < outLen - 1 && raw[n] != 0; n++) {
        char c = raw[n];
        bool ok = (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9');
        out[n] = ok ? c : '_';
    }
    out[n] = 0;
}

// Builds the JSON body shared by both HTTP and MQTT forwarding.
void buildJson(const MeshPacket& pkt, int rssi, float snr, char* out, size_t outLen) {
    char victimId[9];
    sanitizeVictimId(pkt.victimId, victimId, sizeof(victimId));

    snprintf(out, outLen,
        "{\"gatewayId\":\"%s\",\"gatewayLat\":%.6f,\"gatewayLng\":%.6f,"
        "\"nodeId\":\"%08X\",\"seq\":%u,\"msgType\":%u,"
        "\"fix\":%s,\"lat\":%.6f,\"lng\":%.6f,\"sats\":%u,"
        "\"bleVictims\":%u,\"nearestRssi\":%d,\"nearestVictimId\":\"%s\",\"victimStatus\":%u,"
        "\"hopCount\":%u,\"uptime\":%u,\"loraRssi\":%d,\"loraSnr\":%.1f}",
        gatewayId.c_str(), GATEWAY_LAT, GATEWAY_LNG,
        pkt.nodeId, pkt.seq, pkt.msgType,
        pkt.gpsFix ? "true" : "false",
        pkt.gpsFix ? pkt.lat_e6 / 1e6 : 0.0,
        pkt.gpsFix ? pkt.lng_e6 / 1e6 : 0.0,
        pkt.sats, pkt.bleVictims, pkt.nearestRssi, victimId, pkt.victimStatus,
        pkt.hopCount, pkt.uptimeSec, rssi, snr);
}

void processPacket(const uint8_t* data, int len, int rssi, float snr) {
    MeshPacket pkt;
    if (!decodePacket(data, len, pkt)) {
        Serial.print("[LoRa RX] Invalid packet: len=");
        Serial.print(len);
        Serial.print(" (expected ");
        Serial.print((int)sizeof(MeshPacket));
        Serial.print("), magic=0x");
        Serial.print(len > 0 ? data[0] : 0, HEX);
        Serial.println(" - check sync word or RF saturation (move devices further apart)");
        return;
    }

    if (seenFilter.seenBefore(pkt.nodeId, pkt.seq)) {
        Serial.print("[LoRa RX] duplicate node=");
        Serial.printf("%08X", pkt.nodeId);
        Serial.print(" seq="); Serial.print(pkt.seq);
        Serial.print(" hopsLeft="); Serial.print(pkt.hopCount);
        Serial.println(" (ignored)");
        return;
    }
    rxCount++;

    // ---- Always: print to Serial (this IS the UART forward to the
    // local server if it's plugged in via USB and reading this port) ----
    Serial.println();
    Serial.print("========== RX #"); Serial.print(rxCount);
    Serial.print(" node="); Serial.print(pkt.nodeId, HEX);
    Serial.print(" seq="); Serial.println(pkt.seq);
    Serial.print("Type: "); Serial.println(pkt.msgType == ZA_MSG_SOS ? "SOS [ALERT]" : "telemetry");
    if (pkt.gpsFix) {
        Serial.print("Pos : "); Serial.print(pkt.lat_e6 / 1e6, 6);
        Serial.print(", "); Serial.println(pkt.lng_e6 / 1e6, 6);
    } else {
        Serial.println("Pos : no fix");
    }
    Serial.print("Victims nearby: "); Serial.print(pkt.bleVictims);
    Serial.print("  Nearest RSSI: "); Serial.println(pkt.nearestRssi);
    Serial.print("Hops left: "); Serial.print(pkt.hopCount);
    Serial.print("  LoRa RSSI: "); Serial.print(rssi);
    Serial.print(" ["); Serial.print(rssiQuality(rssi)); Serial.println("]");

    char json[384];
    buildJson(pkt, rssi, snr, json, sizeof(json));

    // Machine-readable UART forward
    Serial.print("JSON:");
    Serial.println(json);

#if FORWARD_VIA_HTTP
    if (httpBackoffActive && millis() - httpBackoffStart >= HTTP_BACKOFF_MS) {
        httpBackoffActive = false;
    }
    if (WiFi.status() != WL_CONNECTED) {
        Serial.println("HTTP forward: skipped (WiFi not connected)");
    } else if (httpBackoffActive) {
        Serial.println("HTTP forward: skipped (backoff)");
    } else {
        HTTPClient http;
        http.setConnectTimeout(HTTP_CONNECT_TIMEOUT_MS);
        http.setTimeout(HTTP_TIMEOUT_MS);
        http.begin(SERVER_URL);
        http.addHeader("Content-Type", "application/json");
        http.addHeader("X-Gateway-Key", GATEWAY_API_KEY);
        int code = http.POST((uint8_t*)json, strlen(json));
        http.end();
        Serial.print("HTTP forward: ");
        Serial.println((code > 0 && code < 300) ? "OK" : ("FAILED code=" + String(code)));
        if (code <= 0) {
            // Connection-level failure (server down/unreachable/timeout):
            // pause HTTP for a while so the gateway stays responsive.
            httpBackoffActive = true;
            httpBackoffStart = millis();
            Serial.print("HTTP forward: backing off for ");
            Serial.print(HTTP_BACKOFF_MS / 1000);
            Serial.println(" s");
        }
    }
#endif

#if FORWARD_VIA_MQTT
    if (mqttClient.connected()) {
        bool ok = mqttClient.publish(MQTT_TOPIC, json);
        Serial.print("MQTT publish: ");
        Serial.println(ok ? "OK" : "FAILED");
    }
#endif

    Serial.println("==============================");
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
        int rssi = LoRa.packetRssi();
        float snr = LoRa.packetSnr();
        // Bytes/RSSI/SNR are copied out, so re-arm the radio BEFORE the
        // slow part (Serial print + HTTP POST) - otherwise the gateway is
        // deaf to other pods for as long as the backend takes to answer.
        LoRa.receive(); // re-enable continuous reception
        processPacket(data, len, rssi, snr);
    }
}

void setup() {
    Serial.begin(115200);
    delay(1000);

    gatewayId = "GW-" + String((uint32_t)(ESP.getEfuseMac() >> 16), HEX);

    Serial.println();
    Serial.println("========================================");
    Serial.println("     ZAMBOALERT - STATIC BARANGAY GATEWAY");
    Serial.println("========================================");
    Serial.print("Gateway ID: "); Serial.println(gatewayId);
    Serial.print("Fixed location: "); Serial.print(GATEWAY_LAT, 6);
    Serial.print(", "); Serial.println(GATEWAY_LNG, 6);
    Serial.println();

    seenFilter.init();

    if (!setupLora()) {
        Serial.println("LoRa init FAILED - check SX1278 wiring/power. Halting.");
        while (true) delay(1000);
    }
    Serial.print("LoRa mesh radio listening @ ");
    Serial.print(LORA_FREQ_HZ / 1E6, 1);
    Serial.print("MHz, SF"); Serial.print(LORA_SF);
    Serial.print(", sync 0x"); Serial.print(LORA_SYNC_WORD, HEX);
    Serial.println(".");

#if FORWARD_VIA_HTTP || FORWARD_VIA_MQTT
    connectWifi();
#endif
#if FORWARD_VIA_MQTT
    mqttClient.setServer(MQTT_BROKER_HOST, MQTT_BROKER_PORT);
#endif
#if FORWARD_VIA_HTTP
    Serial.print("HTTP forwarding to: "); Serial.println(SERVER_URL);
#endif
#if FORWARD_VIA_MQTT
    Serial.print("MQTT forwarding to: "); Serial.print(MQTT_BROKER_HOST);
    Serial.print(" topic "); Serial.println(MQTT_TOPIC);
#endif

    Serial.println();
    Serial.println("Wiring (no GPS on this node - fixed location above):");
    Serial.printf("SX1278 -> 3V3/GND, SCK%d MISO%d MOSI%d NSS%d RST%d DIO0 %d\n",
                  LORA_SCK_PIN, LORA_MISO_PIN, LORA_MOSI_PIN,
                  LORA_NSS_PIN, LORA_RST_PIN, LORA_DIO0_PIN);
    Serial.println("Interactive testing: Type 't' in Serial for test Telemetry, 's' for test SOS.");
}

void loop() {
#if FORWARD_VIA_HTTP || FORWARD_VIA_MQTT
    maintainWifi();
#endif
#if FORWARD_VIA_MQTT
    maintainMqtt();
#endif
    handleLoraRx();

    // Check for interactive Serial test commands
    // Test packets share one fake nodeId, so each injection gets a fresh
    // seq - otherwise the duplicate filter would drop repeated 't'/'s'.
    static uint32_t testSeq = 900;
    if (Serial.available()) {
        char ch = Serial.read();
        if (ch == 't' || ch == 'T') {
            Serial.println("[TEST] Generating simulated Telemetry to test HTTP / Dashboard...");
            MeshPacket testPkt;
            testPkt.magic = ZA_MAGIC;
            testPkt.msgType = ZA_MSG_TELEMETRY;
            testPkt.nodeId = 0xAA11BB22;
            testPkt.seq = ++testSeq;
            testPkt.lat_e6 = (int32_t)(GATEWAY_LAT * 1e6);
            testPkt.lng_e6 = (int32_t)(GATEWAY_LNG * 1e6);
            testPkt.sats = 6;
            testPkt.gpsFix = 1;
            testPkt.bleVictims = 0;
            testPkt.nearestRssi = -127;
            memset(testPkt.victimId, 0, sizeof(testPkt.victimId));
            testPkt.victimStatus = 0;
            testPkt.hopCount = 4;
            testPkt.uptimeSec = millis() / 1000;
            processPacket((const uint8_t*)&testPkt, sizeof(MeshPacket), -65, 8.5);
        } else if (ch == 's' || ch == 'S') {
            Serial.println("[TEST] Generating simulated SOS to test HTTP / Dashboard...");
            MeshPacket testPkt;
            testPkt.magic = ZA_MAGIC;
            testPkt.msgType = ZA_MSG_SOS;
            testPkt.nodeId = 0xAA11BB22;
            testPkt.seq = ++testSeq;
            testPkt.lat_e6 = (int32_t)(GATEWAY_LAT * 1e6);
            testPkt.lng_e6 = (int32_t)(GATEWAY_LNG * 1e6);
            testPkt.sats = 6;
            testPkt.gpsFix = 1;
            testPkt.bleVictims = 1;
            testPkt.nearestRssi = -55;
            strncpy(testPkt.victimId, "VIC-01", 8);
            testPkt.victimStatus = 0;
            testPkt.hopCount = 4;
            testPkt.uptimeSec = millis() / 1000;
            processPacket((const uint8_t*)&testPkt, sizeof(MeshPacket), -55, 9.0);
        }
    }

    // Periodic heartbeat on Serial so user knows gateway is healthy and listening
    static unsigned long lastHeartbeat = 0;
    unsigned long now = millis();
    if (now - lastHeartbeat >= 20000) {
        lastHeartbeat = now;
        Serial.print("[Gateway Status] Radio listening @ ");
        Serial.print(LORA_FREQ_HZ / 1E6, 1);
        Serial.print("MHz | Packets received: ");
        Serial.print(rxCount);
#if FORWARD_VIA_HTTP
        Serial.print(" | WiFi: ");
        Serial.print(WiFi.status() == WL_CONNECTED ? "Connected (" + WiFi.localIP().toString() + ")" : "Disconnected");
#endif
        Serial.println(" | Tip: Send 't' or 's' in Serial to test HTTP");
    }

    delay(10);
}
