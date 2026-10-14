/**
 * Root backend (auth + telemetry + citizen SOS GPS).
 * Local LAN: http://<PC-LAN-IP>:3000
 * Cloud: https://your-deployed-backend.example.com
 *
 * UPDATE THIS to the PC's current LAN IP whenever the network changes.
 * Run `ipconfig` (Windows) or `ip addr` (Linux/Mac) to find the current IP.
 */
export const API_BASE_URL = 'http://192.168.1.17:3000';
