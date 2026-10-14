#pragma once
// =====================================================================
// ZamboAlert - Static Barangay Gateway Node - config.h
// Fill in / adjust values below before flashing.
// =====================================================================

// ---------- LoRa radio (SX1278 / Ra-01) ----------
// Must match the pod's config.h exactly, or they won't hear each other.
#define LORA_SCK_PIN   18
#define LORA_MISO_PIN  19
#define LORA_MOSI_PIN  23
#define LORA_NSS_PIN   5
#define LORA_RST_PIN   14
#define LORA_DIO0_PIN  26
#define LORA_FREQ_HZ   433E6
#define LORA_SF        9
#define LORA_BW_HZ     125E3
#define LORA_SYNC_WORD 0x12

// ---------- Fixed, surveyed gateway location ----------
// Set this once at install time (phone GPS or handheld unit at the
// barangay hall). The gateway has no onboard GPS - see earlier discussion
// on why that's correct for a stationary node.
#define GATEWAY_LAT 6.912345
#define GATEWAY_LNG 122.079876

// ---------- Forwarding toggles ----------
// 1 = enabled, 0 = disabled. Both can be on at the same time.
// Serial/UART forwarding (the "JSON:" lines) is ALWAYS on regardless of
// these - that's just Serial.println(), it costs nothing to leave running.
#define FORWARD_VIA_HTTP 1
#define FORWARD_VIA_MQTT 0

// ---------- Wi-Fi (barangay hall local network) ----------
#define WIFI_SSID     "No Internet"
#define WIFI_PASSWORD "Unding.2007"

// ---------- HTTP target (only used if FORWARD_VIA_HTTP is 1) ----------
#define SERVER_URL "http://192.168.1.17:3000/api/telemetry"
#define GATEWAY_API_KEY "c44cd9714f6d56f4f1d31e86c6e6876f5c5055f7635bd9e7bcb2087392016e04"

// ---------- MQTT target (only used if FORWARD_VIA_MQTT is 1) ----------
#define MQTT_BROKER_HOST "192.168.1.17"
#define MQTT_BROKER_PORT 1883
#define MQTT_TOPIC "zamboalert/telemetry"
