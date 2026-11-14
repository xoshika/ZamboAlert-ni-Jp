#pragma once
// =====================================================================
// ZamboAlert - Portable Rescuer Signal Pod - config.h
// Fill in / adjust values below as needed for your hardware and build.
// =====================================================================

// ---------- GPS (NEO-6M) ----------
#define GPS_BAUD 9600
#define GPS_RX_PIN 16   // ESP32 pin wired to GPS TX
#define GPS_TX_PIN 17   // ESP32 pin wired to GPS RX

// ---------- LoRa radio (SX1278 / Ra-01) ----------
// Must match the gateway's config.h exactly, or they won't hear each other.
#define LORA_SCK_PIN   18
#define LORA_MISO_PIN  19
#define LORA_MOSI_PIN  23
#define LORA_NSS_PIN   5
#define LORA_RST_PIN   14
// DIO0 on GPIO 4 (B-side pin) so the 38-pin ESP32 fits one breadboard:
// its J-side pins have no free holes. Was GPIO 26.
#define LORA_DIO0_PIN  4
#define LORA_FREQ_HZ   433E6
// Set to 2 dBm (minimum power, only ~18mA current) to guarantee zero brownout
// while testing on USB power and breadboard. Still easily covers 50+ meters.
#define LORA_TX_POWER_DBM 2
#define LORA_SF        9
#define LORA_BW_HZ     125E3
#define LORA_SYNC_WORD 0x12

// ---------- Buzzer / LED ----------
// Buzzer and LED on B-side pins (compact breadboard layout). Were 25 / 27.
#define BUZZER_PIN 22
#define LED_PIN    21

// ---------- BLE SOS detection ----------
// The Citizen app advertises this service UUID when an SOS is active.
// The name prefix remains supported for older beacon implementations.
#define VICTIM_BLE_NAME_PREFIX "ZA-SOS"
#define SOS_SERVICE_UUID "fef10001-7b82-4b93-b2c2-0f81ea3300a1"
// RSSI (dBm) at which the pod considers itself "close enough" to buzz/light.
// -85 is realistic for smartphones indoors or at normal room distances (was -65 which was too strict).
#define PROXIMITY_RSSI_THRESHOLD -85
// How many times a mesh packet can be relayed before it's dropped.
#define MESH_TTL 4

// ---------- Indoor testing fallback ----------
// If 1, assigns default coordinates when NEO-6M has no fix yet so the
// web map can display the pod during indoor desk testing. When real GPS locks,
// real satellite coordinates automatically take precedence.
// MUST stay 0 for deployment: only real GPS fixes may be reported (with 1, a
// pod without a lock is reported as gpsFix=1 at the fake FALLBACK_LAT/LNG).
#define GPS_INDOOR_TEST_FALLBACK 0
#define FALLBACK_LAT 6.912345
#define FALLBACK_LNG 122.079876
