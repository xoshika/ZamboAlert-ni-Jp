
# ZamboAlert - Rescuers App (Mobile Only)

ZamboAlert is an IoT-based emergency communication mobile application utilizing LoRa mesh networks integrated with a victim-side Bluetooth-fallback mechanism. This repository contains the mobile-only client for rescue teams, developed using **React Native**, **Expo**, and **TypeScript**.

## Features

- **Radar View**: Provides live bearing, distance, and floor indicators to selected victims, using smooth rotational math and compass headings (`N`, `NE`, `E`, etc.).
- **Map View**: Displays an offline cached floor-plan HUD showing rescuer tracking, victim locations on different floors, and an auto-navigating route indicator.
- **Pods View**: Visualizes status overview for active mesh nodes (`ONLINE`, `SYNCING`, `OFFLINE`) alongside signal, battery levels, and hops count.
- **Log View**: Renders real-time telemetry events categorized by source (`BLE`, `MESH`, `VICTIM`, `ALERT`, `SYSTEM`).
- **HUD Alerts & Toasts**: Built-in critical alert banners for quick navigation switching and lightweight custom overlay notifications.

---

## Getting Started

### Prerequisites

Make sure you have Node.js and the [Expo Go](https://expo.dev/go) app installed on your physical mobile device, or have an Android/iOS emulator configured.

### Installation

1. Install dependencies using:
   ```bash
   npm install --legacy-peer-deps
   ```

### Running the App

Start the Expo bundler:
```bash
npm start
```

This will boot the Metro Bundler. From here you can:
- Scan the printed QR code with your phone camera (iOS) or Expo Go app (Android) to run it on your device.
- Press `a` to open on an Android Emulator.
- Press `i` to open on an iOS Simulator.
- Press `w` to run on web (Expo web wrapper).
