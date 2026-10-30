/**
 * ZamboAlert Unified Backend — index.js
 *
 * Single Express server on PORT (default 3000) that replaces BOTH:
 *   - backend/src/index.js  (root backend: LoRa gateway telemetry, mobile auth)
 *   - zamboalert-web/backend/server.js  (web backend: SQLite admin CRUD)
 *
 * Auth strategy:
 *   - Mobile app (citizen / rescuer): SHA-256 password hash, session token
 *   - Web dashboard (barangay_official): bcrypt password, JWT + 2FA flow
 *
 * Database: SQLite (backend/src/zamboalert.db)
 * Live telemetry: in-memory arrays in database.js (reset on restart)
 */

const express = require('express');
const crypto = require('crypto');
const path = require('path');
const nodemailer = require('nodemailer');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const { db, podTelemetry, citizenSos } = require('./database');

const app = express();
const PORT = Number(process.env.PORT || 3000);
const JWT_SECRET = process.env.JWT_SECRET || 'zamboalert_secret_jwt_key_12345';
const VERIFICATION_CODE_TTL_MS = 10 * 60 * 1000;   // 10 min
const CITIZEN_SOS_TTL_MS       = 10 * 60 * 1000;   // 10 min
const POD_TTL_MS               = 90 * 1000;         // 90 s
const DISASTER_TYPES = new Set(['earthquake', 'flood', 'fire', 'landslide']);

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// CORS — wide open (LAN + cloud usage)
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-Gateway-Key, X-Admin-Key');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// Serve legacy admin public dashboard (hardware dashboard page)
app.use(express.static(path.join(__dirname, '../public')));

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Custom SHA-256 (mobile app password hashing — keeps mobile compatibility) */
function sha256(ascii) {
  function rightRotate(value, amount) {
    return (value >>> amount) | (value << (32 - amount));
  }
  const hash = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
  const K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106bb041,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];
  let asciiLength = ascii.length;
  let words = [];
  for (let i = 0; i < asciiLength; i++) words[i >> 2] |= ascii.charCodeAt(i) << (24 - (i % 4) * 8);
  words[asciiLength >> 2] |= 0x80 << (24 - (asciiLength % 4) * 8);
  let wordCount = ((asciiLength + 8) >> 6) * 16 + 16;
  while (words.length < wordCount) words.push(0);
  words[wordCount - 1] = asciiLength * 8;
  for (let i = 0; i < wordCount; i += 16) {
    let w = [];
    for (let j = 0; j < 16; j++) w[j] = words[i + j];
    for (let j = 16; j < 64; j++) {
      let s0 = rightRotate(w[j-15], 7) ^ rightRotate(w[j-15], 18) ^ (w[j-15] >>> 3);
      let s1 = rightRotate(w[j-2], 17) ^ rightRotate(w[j-2], 19) ^ (w[j-2] >>> 10);
      w[j] = (w[j-16] + s0 + w[j-7] + s1) | 0;
    }
    let [a, b, c, d, e, f, g, h] = hash;
    for (let j = 0; j < 64; j++) {
      let S1 = rightRotate(e,6) ^ rightRotate(e,11) ^ rightRotate(e,25);
      let ch = (e & f) ^ (~e & g);
      let temp1 = (h + S1 + ch + K[j] + w[j]) | 0;
      let S0 = rightRotate(a,2) ^ rightRotate(a,13) ^ rightRotate(a,22);
      let maj = (a & b) ^ (a & c) ^ (b & c);
      let temp2 = (S0 + maj) | 0;
      h = g; g = f; f = e; e = (d + temp1) | 0;
      d = c; c = b; b = a; a = (temp1 + temp2) | 0;
    }
    hash[0] = (hash[0]+a)|0; hash[1] = (hash[1]+b)|0;
    hash[2] = (hash[2]+c)|0; hash[3] = (hash[3]+d)|0;
    hash[4] = (hash[4]+e)|0; hash[5] = (hash[5]+f)|0;
    hash[6] = (hash[6]+g)|0; hash[7] = (hash[7]+h)|0;
  }
  return hash.map(v => { let h = (v>>>0).toString(16); return '00000000'.substring(h.length) + h; }).join('');
}

function generateCode() {
  return crypto.randomInt(100000, 1000000).toString();
}

function validNumber(v, min, max) {
  return typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
}

// ── Email helpers ─────────────────────────────────────────────────────────────

function getTransporter() {
  const gmailUser = process.env.GMAIL_USER;
  const gmailPass = (process.env.GMAIL_APP_PASSWORD || process.env.GMAIL_PASSWORD || '').replace(/\s/g, '');
  if (gmailUser && gmailPass) {
    const port = parseInt(process.env.SMTP_PORT || '465');
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port,
      secure: port === 465,
      auth: { user: gmailUser, pass: gmailPass },
      family: 4,
      connectionTimeout: 7000,
      greetingTimeout: 7000,
      socketTimeout: 12000,
      tls: { rejectUnauthorized: false },
    });
  }
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    const port = parseInt(process.env.SMTP_PORT || '587');
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: process.env.SMTP_SECURE === 'true' || port === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      family: 4,
      connectionTimeout: 7000,
      greetingTimeout: 7000,
      socketTimeout: 12000,
      tls: { rejectUnauthorized: false },
    });
  }
  return null;
}

async function sendMail(to, subject, text, html, code = null) {
  // 1. Resend API (HTTPS — immune to SMTP port blocking)
  if (process.env.RESEND_API_KEY) {
    try {
      const resp = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: process.env.RESEND_FROM || 'ZamboAlert <onboarding@resend.dev>', to: [to], subject, text, html }),
      });
      if (resp.ok) { console.log(`[Resend] Email sent to ${to}`); return true; }
      console.warn('[Resend] Error:', await resp.text());
    } catch (e) { console.warn('[Resend] Failed:', e.message); }
  }

  // 2. Brevo API (HTTPS)
  if (process.env.BREVO_API_KEY) {
    try {
      const resp = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: { 'api-key': process.env.BREVO_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sender: { name: 'ZamboAlert Security', email: process.env.BREVO_FROM_EMAIL || process.env.GMAIL_USER || 'admin@zamboalert.com' },
          to: [{ email: to }], subject, textContent: text, htmlContent: html,
        }),
      });
      if (resp.ok) { console.log(`[Brevo] Email sent to ${to}`); return true; }
      console.warn('[Brevo] Error:', await resp.text());
    } catch (e) { console.warn('[Brevo] Failed:', e.message); }
  }

  // 3. Nodemailer SMTP fallback
  const transporter = getTransporter();
  const fromEmail = process.env.GMAIL_USER || process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER || 'no-reply@zamboalert.com';
  const fromName = process.env.SMTP_FROM_NAME || 'ZamboAlert Security';
  if (transporter) {
    try {
      await transporter.sendMail({ from: `"${fromName}" <${fromEmail}>`, to, subject, text, html });
      console.log(`[SMTP] Email sent to ${to}`);
      return true;
    } catch (err) {
      console.error(`[SMTP] Failed: ${err.message}`);
      if (code) console.log(`>>> FALLBACK CODE for ${to}: ${code} <<<`);
      return false;
    }
  }
  console.log(`[No mailer configured] Email to: ${to}${code ? ` | code: ${code}` : ''}`);
  return false;
}

function verificationEmailHtml(username, code, expiryMinutes = 10) {
  return `<div style="font-family:sans-serif;padding:20px;border:1px solid #f1f1f1;border-radius:8px;max-width:500px;margin:auto;">
    <h2 style="color:#b91c1c;text-align:center;">ZamboAlert Security</h2>
    <p>Hello <strong>${username}</strong>,</p>
    <p>Your email verification code is:</p>
    <div style="font-size:24px;font-weight:bold;text-align:center;padding:15px;background:#fef2f2;border:1px dashed #f87171;color:#b91c1c;margin:20px 0;border-radius:4px;letter-spacing:4px;">${code}</div>
    <p style="font-size:12px;color:#6b7280;text-align:center;">Expires in ${expiryMinutes} minutes.</p>
  </div>`;
}

function twoFaEmailHtml(username, code) {
  return `<div style="font-family:sans-serif;padding:20px;border:1px solid #f1f1f1;border-radius:8px;max-width:500px;margin:auto;">
    <h2 style="color:#b91c1c;text-align:center;">ZamboAlert 2FA Security</h2>
    <p>Hello <strong>${username}</strong>,</p>
    <p>Your 2-Factor login code is:</p>
    <div style="font-size:24px;font-weight:bold;text-align:center;padding:15px;background:#fef2f2;border:1px dashed #f87171;color:#b91c1c;margin:20px 0;border-radius:4px;letter-spacing:4px;">${code}</div>
    <p style="font-size:12px;color:#6b7280;text-align:center;">Expires in 5 minutes.</p>
  </div>`;
}

// ── Middleware: Admin key guard ────────────────────────────────────────────────
function requireAdminKey(req, res, next) {
  const expectedKey = process.env.ADMIN_API_KEY || '';
  if (!expectedKey) return next(); // permissive in local dev
  const supplied = (req.get('X-Admin-Key') || req.query.adminKey || '').trim();
  if (!supplied || supplied.length !== expectedKey.length || !crypto.timingSafeEqual(Buffer.from(supplied), Buffer.from(expectedKey))) {
    return res.status(401).json({ error: 'Unauthorized: invalid or missing admin key.' });
  }
  next();
}

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() });
});

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 1: LoRa Gateway Telemetry (Hardware Pods)
// ══════════════════════════════════════════════════════════════════════════════

app.post('/api/telemetry', (req, res) => {
  const expectedKey = process.env.GATEWAY_API_KEY || '';
  const suppliedKey = req.get('X-Gateway-Key') || '';
  if (!expectedKey) return res.status(503).json({ message: 'Gateway telemetry is not configured on this server.' });
  const sb = Buffer.from(suppliedKey), eb = Buffer.from(expectedKey);
  if (sb.length !== eb.length || !crypto.timingSafeEqual(sb, eb)) {
    return res.status(401).json({ message: 'Invalid gateway key.' });
  }

  const body = req.body || {};
  const nodeId = typeof body.nodeId === 'string' ? body.nodeId.toUpperCase() : '';
  const gatewayId = typeof body.gatewayId === 'string' ? body.gatewayId : '';
  const fix = body.fix === true;
  const valid =
    /^[0-9A-F]{1,8}$/.test(nodeId) &&
    gatewayId.length > 0 && gatewayId.length <= 40 &&
    Number.isInteger(body.seq) && body.seq >= 0 && body.seq <= 4294967295 &&
    [0, 1].includes(body.msgType) &&
    typeof body.fix === 'boolean' &&
    (!fix || (validNumber(body.lat, -90, 90) && validNumber(body.lng, -180, 180))) &&
    validNumber(body.gatewayLat, -90, 90) && validNumber(body.gatewayLng, -180, 180) &&
    Number.isInteger(body.sats) && body.sats >= 0 && body.sats <= 255 &&
    Number.isInteger(body.bleVictims) && body.bleVictims >= 0 && body.bleVictims <= 255 &&
    Number.isInteger(body.nearestRssi) && body.nearestRssi >= -127 && body.nearestRssi <= 0 &&
    typeof body.nearestVictimId === 'string' && /^[A-Za-z0-9_]{0,8}$/.test(body.nearestVictimId) &&
    Number.isInteger(body.victimStatus) && body.victimStatus >= 0 && body.victimStatus <= 255 &&
    Number.isInteger(body.hopCount) && body.hopCount >= 0 && body.hopCount <= 255 &&
    Number.isInteger(body.uptime) && body.uptime >= 0 && body.uptime <= 4294967295 &&
    Number.isInteger(body.loraRssi) && body.loraRssi >= -127 && body.loraRssi <= 0 &&
    validNumber(body.loraSnr, -50, 50);

  if (!valid) return res.status(400).json({ message: 'Invalid telemetry packet.' });

  const receivedAt = new Date().toISOString();
  const report = {
    nodeId, gatewayId, seq: body.seq, msgType: body.msgType, fix,
    lat: fix ? body.lat : null, lng: fix ? body.lng : null,
    gatewayLat: body.gatewayLat, gatewayLng: body.gatewayLng,
    sats: body.sats, bleVictims: body.bleVictims,
    nearestRssi: body.nearestRssi, nearestVictimId: body.nearestVictimId,
    victimStatus: body.victimStatus, hopCount: body.hopCount,
    uptime: body.uptime, loraRssi: body.loraRssi, loraSnr: body.loraSnr,
    receivedAt,
  };
  const idx = podTelemetry.findIndex(p => p.nodeId === nodeId);
  if (idx === -1) podTelemetry.push(report); else podTelemetry[idx] = report;
  return res.status(202).json({ message: 'Telemetry received.', nodeId });
});

app.get('/api/telemetry', (req, res) => {
  const podCutoff     = Date.now() - POD_TTL_MS;
  const citizenCutoff = Date.now() - CITIZEN_SOS_TTL_MS;
  const active = podTelemetry
    .filter(r => {
      const t = Date.parse(r.receivedAt);
      if (!Number.isFinite(t)) return false;
      return t >= (r.gatewayId === 'CITIZEN-APP-GATEWAY' ? citizenCutoff : podCutoff);
    })
    .sort((a, b) => Date.parse(b.receivedAt) - Date.parse(a.receivedAt));
  return res.json(active);
});

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 2: Citizen Phone GPS SOS
// ══════════════════════════════════════════════════════════════════════════════

app.post('/api/sos', (req, res) => {
  const body = req.body || {};
  const clientId = typeof body.clientId === 'string' ? body.clientId.trim().slice(0, 64) : '';
  const name = typeof body.name === 'string' ? body.name.trim().slice(0, 80) : 'Citizen';
  const disasterType = typeof body.disasterType === 'string' ? body.disasterType.trim().toLowerCase() : '';
  if (!clientId || !validNumber(body.lat, -90, 90) || !validNumber(body.lng, -180, 180) || !DISASTER_TYPES.has(disasterType)) {
    return res.status(400).json({ message: 'Invalid citizen SOS payload.' });
  }
  const receivedAt = new Date().toISOString();
  const report = {
    id: `SOS-${clientId.slice(0, 8).toUpperCase()}`, clientId,
    name: name || 'Citizen', lat: body.lat, lng: body.lng,
    disasterType, status: 'active', receivedAt,
  };
  const idx = citizenSos.findIndex(s => s.clientId === clientId);
  if (idx === -1) citizenSos.push(report); else citizenSos[idx] = report;

  // Mirror to podTelemetry as a virtual "CITIZEN-APP-GATEWAY" pod
  const virtualNodeId = crypto.createHash('md5').update(clientId).digest('hex').slice(0, 6).toUpperCase();
  const virtualPod = {
    nodeId: virtualNodeId, gatewayId: 'CITIZEN-APP-GATEWAY',
    seq: 1, msgType: 1, fix: true, lat: body.lat, lng: body.lng,
    gatewayLat: body.lat, gatewayLng: body.lng, sats: 12, bleVictims: 1,
    nearestRssi: -45, nearestVictimId: clientId.slice(0, 8).toUpperCase(),
    victimStatus: 3, hopCount: 0, uptime: 60, loraRssi: -50, loraSnr: 9.0,
    receivedAt,
  };
  const pidx = podTelemetry.findIndex(p => p.nodeId === virtualNodeId);
  if (pidx === -1) podTelemetry.push(virtualPod); else podTelemetry[pidx] = virtualPod;

  return res.status(202).json({ message: 'Citizen SOS received.', id: report.id, clientId, virtualNodeId });
});

app.get('/api/sos', (req, res) => {
  const cutoff = Date.now() - CITIZEN_SOS_TTL_MS;
  const active = citizenSos
    .filter(r => r.status === 'active' && Number.isFinite(Date.parse(r.receivedAt)) && Date.parse(r.receivedAt) >= cutoff)
    .sort((a, b) => Date.parse(b.receivedAt) - Date.parse(a.receivedAt));
  return res.json(active);
});

app.delete('/api/sos', (req, res) => {
  const body = req.body || {};
  const clientId = (typeof body.clientId === 'string' && body.clientId.trim()) ||
    (typeof req.query.clientId === 'string' && req.query.clientId.trim()) || '';
  if (!clientId) return res.status(400).json({ message: 'clientId is required.' });

  const before = citizenSos.length;
  citizenSos.splice(0, citizenSos.length, ...citizenSos.filter(s => s.clientId !== clientId));
  const virtualNodeId = crypto.createHash('md5').update(clientId).digest('hex').slice(0, 6).toUpperCase();
  podTelemetry.splice(0, podTelemetry.length, ...podTelemetry.filter(p => p.nodeId !== virtualNodeId));

  return res.status(200).json({ message: 'Citizen SOS cleared.', clientId });
});

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 3: Authentication — Mobile App (SHA-256, session tokens)
// ══════════════════════════════════════════════════════════════════════════════

// Helper: find user in SQLite by email
function findUserByEmail(email) {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM users WHERE LOWER(email) = ?', [email.toLowerCase()], (err, row) => {
      if (err) reject(err); else resolve(row);
    });
  });
}

function buildPublicUser(u) {
  return {
    id: u.id, firstName: u.first_name, lastName: u.last_name,
    name: `${u.first_name} ${u.last_name}`.trim(),
    email: u.email, role: u.role,
    mfaEnabled: !!u.mfa_enabled,
    contactNumber: u.contact_number,
    idType: u.id_type, idNumber: u.id_number,
    isRescuerVerified: u.is_rescuer_verified,
  };
}

function buildSession(u, ip) {
  const token = `token-${u.id}-${crypto.randomBytes(16).toString('hex')}`;
  return {
    id: `session-${u.id}-${Date.now()}`,
    loginTime: Date.now(),
    deviceInfo: 'App Connected (Live)',
    ipAddress: ip || '127.0.0.1',
    token,
    expiresAt: Date.now() + 60 * 60 * 1000,
  };
}

// POST /api/auth/signup  — Mobile signup
app.post('/api/auth/signup', async (req, res) => {
  const { firstName, lastName, email, password, role, contactNumber, idType, idNumber, idFrontUri, idBackUri } = req.body;
  if (!firstName || !lastName || !email || !password || !role || !contactNumber) {
    return res.status(400).json({ error: 'All primary fields are required.' });
  }
  try {
    const existing = await findUserByEmail(email.trim());
    if (existing) return res.status(400).json({ error: 'An account with this email already exists. Try logging in.' });

    const code = generateCode();
    const userId = String(Date.now());
    const isRescuer = role === 'rescuer';
    await new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO users (id, first_name, last_name, email, password_hash, role, is_verified, is_rescuer_verified,
           contact_number, id_type, id_number, id_front_uri, id_back_uri,
           email_verification_code_hash, email_verification_expires_at)
         VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          userId, firstName.trim(), lastName.trim(), email.trim().toLowerCase(),
          sha256(password), role,
          isRescuer ? 0 : null,
          contactNumber.trim(),
          isRescuer ? (idType || null) : null,
          isRescuer ? (idNumber || null) : null,
          isRescuer ? (idFrontUri || null) : null,
          isRescuer ? (idBackUri || null) : null,
          sha256(code),
          Date.now() + VERIFICATION_CODE_TTL_MS,
        ],
        err => err ? reject(err) : resolve()
      );
    });

    try {
      const html = verificationEmailHtml(`${firstName} ${lastName}`, code);
      await sendMail(email.trim().toLowerCase(), 'Your ZamboAlert verification code',
        `Your verification code is ${code}. It expires in 10 minutes.`, html, code);
    } catch (mailErr) {
      console.error('Signup email failed:', mailErr.message);
      return res.status(503).json({ error: 'Could not send verification email. Check Gmail config and try again.' });
    }

    return res.json({ success: true, email: email.trim().toLowerCase() });
  } catch (err) {
    console.error('Signup error:', err);
    return res.status(500).json({ error: 'Could not create your account. Please try again.' });
  }
});

// POST /api/auth/register  — Web dashboard + mobile alias
app.post('/api/auth/register', async (req, res) => {
  const { firstName, lastName, email, password, phoneNumber, contactNumber, role } = req.body;
  if (!firstName || !lastName || !email || !password) {
    return res.status(400).json({ message: 'All fields are required.', error: 'All fields are required.' });
  }
  const cleanEmail = email.trim().toLowerCase();
  try {
    const existing = await findUserByEmail(cleanEmail);
    const code = generateCode();
    const codeExpires = Date.now() + VERIFICATION_CODE_TTL_MS;
    const phone = (phoneNumber || contactNumber || 'N/A').trim();

    if (existing) {
      if (existing.is_verified) {
        return res.status(400).json({ message: 'An account with this email already exists. Please log in.' });
      }
      // Unverified — update and resend code
      await new Promise((resolve, reject) => {
        db.run(
          `UPDATE users SET first_name=?, last_name=?, password_hash=?, contact_number=?,
             email_verification_code_hash=?, email_verification_expires_at=? WHERE id=?`,
          [firstName.trim(), lastName.trim(), sha256(password), phone, sha256(code), codeExpires, existing.id],
          err => err ? reject(err) : resolve()
        );
      });
    } else {
      const userId = String(Date.now());
      const userRole = role || 'barangay_official';
      // Hash with bcrypt for web dashboard logins; keep sha256 for mobile compat
      const bcryptHash = await bcrypt.hash(password, 10);
      await new Promise((resolve, reject) => {
        db.run(
          `INSERT INTO users (id, first_name, last_name, email, username, password_hash, password_bcrypt, role,
             contact_number, phone_number, email_verification_code_hash, email_verification_expires_at, is_verified)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
          [
            userId, firstName.trim(), lastName.trim(), cleanEmail,
            `${firstName.trim()} ${lastName.trim()}`,
            sha256(password), bcryptHash, userRole, phone, phone,
            sha256(code), codeExpires,
          ],
          err => err ? reject(err) : resolve()
        );
      });
    }

    const username = `${firstName.trim()} ${lastName.trim()}`;
    const emailSent = await sendMail(
      cleanEmail,
      'Verify your ZamboAlert Account',
      `Your verification code is: ${code}. It expires in 10 minutes.`,
      verificationEmailHtml(username, code),
      code
    );
    return res.json({
      success: true,
      message: emailSent ? 'Verification code sent to your email.' : `Account created! Code: ${code}`,
      email: cleanEmail,
      code: !emailSent ? code : undefined,
    });
  } catch (err) {
    console.error('Register error:', err);
    return res.status(500).json({ error: 'Could not create your account. Please try again.' });
  }
});

// POST /api/auth/verify-email
app.post('/api/auth/verify-email', (req, res) => {
  const { email, code } = req.body;
  if (!email || !code) return res.status(400).json({ error: 'Email and verification code are required.' });

  db.get('SELECT * FROM users WHERE LOWER(email) = ?', [email.trim().toLowerCase()], (err, user) => {
    if (err) return res.status(500).json({ error: 'Database error.' });
    if (!user) return res.status(404).json({ error: 'User account not found.' });

    const isExpired = !user.email_verification_expires_at || user.email_verification_expires_at <= Date.now();
    const matchesCode = user.email_verification_code_hash
      ? user.email_verification_code_hash === sha256(code.trim())
      : false;

    if (isExpired) return res.status(400).json({ error: 'That verification code has expired. Request a new code and try again.' });
    if (!matchesCode) return res.status(400).json({ error: 'Incorrect verification code. Please try again.' });

    db.run(
      'UPDATE users SET is_verified=1, email_verification_code_hash=NULL, email_verification_expires_at=NULL WHERE id=?',
      [user.id],
      updateErr => {
        if (updateErr) return res.status(500).json({ error: 'Could not complete verification.' });
        if (user.role === 'citizen' || (user.role === 'rescuer' && user.is_rescuer_verified === 1)) {
          const session = buildSession(user, req.ip);
          return res.json({ success: true, isVerified: true, isRescuerVerified: user.is_rescuer_verified, user: buildPublicUser(user), session });
        }
        return res.json({ success: true, isVerified: true, isRescuerVerified: user.is_rescuer_verified });
      }
    );
  });
});

// POST /api/auth/resend-code
app.post('/api/auth/resend-code', async (req, res) => {
  const { email, type } = req.body; // type: 'register' | 'mfa'
  if (!email) return res.status(400).json({ error: 'Email is required.' });

  db.get('SELECT * FROM users WHERE LOWER(email) = ?', [email.trim().toLowerCase()], async (err, user) => {
    if (err) return res.status(500).json({ error: 'Database error.' });
    if (!user) return res.status(404).json({ error: 'User account not found.' });

    const code = generateCode();
    const isMfa = type === 'mfa';
    const expires = isMfa ? Date.now() + 5 * 60 * 1000 : Date.now() + VERIFICATION_CODE_TTL_MS;

    const sql = isMfa
      ? 'UPDATE users SET two_fa_code=?, two_fa_expires=? WHERE id=?'
      : 'UPDATE users SET email_verification_code_hash=?, email_verification_expires_at=? WHERE id=?';
    const val = isMfa ? code : sha256(code);

    db.run(sql, [val, expires, user.id], async updateErr => {
      if (updateErr) return res.status(500).json({ error: 'Could not update verification request.' });

      const username = `${user.first_name} ${user.last_name}`.trim();
      const subject = isMfa ? 'Your ZamboAlert Login 2FA Code' : 'Verify your ZamboAlert Account';
      const html = isMfa ? twoFaEmailHtml(username, code) : verificationEmailHtml(username, code, isMfa ? 5 : 10);
      const emailSent = await sendMail(user.email, subject, `Your code is: ${code}.`, html, code);
      return res.json({ success: true, message: emailSent ? 'Code sent.' : `Code: ${code}`, code: !emailSent ? code : undefined });
    });
  });
});

// POST /api/auth/login — Unified login (mobile direct token, web 2FA flow)
app.post('/api/auth/login', async (req, res) => {
  const email = (req.body.email || req.body.username || '').trim().toLowerCase();
  const { password, role } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.', message: 'Email and password are required.' });
  }

  db.get(
    'SELECT * FROM users WHERE LOWER(email) = ? OR LOWER(username) = ?',
    [email, email],
    async (err, user) => {
      if (err) return res.status(500).json({ error: 'Database error.', message: 'Database error.' });
      if (!user) return res.status(400).json({ error: 'Incorrect email or password.', message: 'Incorrect email or password.' });

      if (role && user.role !== role) {
        return res.status(400).json({
          error: `This account is registered as a ${user.role}, not a ${role}.`,
          message: `This account is registered as a ${user.role}, not a ${role}.`,
        });
      }
      if (user.role === 'rescuer' && user.is_rescuer_verified === 0) {
        return res.status(403).json({
          error: 'Your rescuer account is pending verification by the admin dashboard.',
          message: 'Your rescuer account is pending verification by the admin dashboard.',
        });
      }

      // Password verification: try SHA-256 first (mobile), then bcrypt (web dashboard)
      const sha256Match = user.password_hash === sha256(password);
      let bcryptMatch = false;
      if (!sha256Match && user.password_bcrypt) {
        bcryptMatch = await bcrypt.compare(password, user.password_bcrypt);
      }

      if (!sha256Match && !bcryptMatch) {
        db.run('UPDATE users SET failed_attempts=failed_attempts+1 WHERE id=?', [user.id]);
        return res.status(400).json({ error: 'Incorrect email or password.', message: 'Incorrect email or password.' });
      }

      db.run('UPDATE users SET failed_attempts=0 WHERE id=?', [user.id]);

      if (!user.is_verified) {
        // Re-send verification code
        const code = generateCode();
        db.run('UPDATE users SET email_verification_code_hash=?, email_verification_expires_at=? WHERE id=?',
          [sha256(code), Date.now() + VERIFICATION_CODE_TTL_MS, user.id]);
        const username = `${user.first_name} ${user.last_name}`.trim();
        try {
          await sendMail(user.email, 'Verify your ZamboAlert Account', `Your code is ${code}.`,
            verificationEmailHtml(username, code), code);
        } catch (e) { /* non-fatal */ }
        return res.json({ requiresVerification: true, email: user.email, unverified: true, message: 'Please verify your email.' });
      }

      // Web dashboard users (barangay_official) require 2FA
      if (user.role === 'barangay_official' || user.role === 'admin') {
        const code = generateCode();
        const expires = Date.now() + 5 * 60 * 1000;
        db.run('UPDATE users SET two_fa_code=?, two_fa_expires=? WHERE id=?', [code, expires, user.id]);
        const username = `${user.first_name} ${user.last_name}`.trim();
        const emailSent = await sendMail(
          user.email,
          'Your ZamboAlert Login 2FA Code',
          `Your 2FA code is: ${code}. It expires in 5 minutes.`,
          twoFaEmailHtml(username, code),
          code
        );
        return res.json({
          message: emailSent
            ? 'Credentials accepted. 2FA verification code sent to your email.'
            : `Credentials accepted! (Email timed out: code is ${code})`,
          username: `${user.first_name} ${user.last_name}`.trim(),
          email: user.email,
          code: !emailSent ? code : undefined,
          requires2fa: true,
        });
      }

      // Mobile users: direct token response
      const session = buildSession(user, req.ip);
      return res.json({
        success: true, user: buildPublicUser(user), session,
        token: session.token, message: 'Signed in successfully.',
      });
    }
  );
});

// POST /api/auth/verify-2fa
app.post('/api/auth/verify-2fa', (req, res) => {
  const usernameOrEmail = (req.body.username || req.body.email || '').trim().toLowerCase();
  const code = (req.body.code || '').toString().trim();
  if (!usernameOrEmail) return res.status(400).json({ error: 'Username or email is required.', message: 'Username or email is required.' });

  db.get(
    'SELECT * FROM users WHERE LOWER(email) = ? OR LOWER(username) = ?',
    [usernameOrEmail, usernameOrEmail],
    (err, user) => {
      if (err) return res.status(500).json({ error: 'Database error.' });
      if (!user) return res.status(404).json({ error: 'User account not found.' });

      if (user.two_fa_code !== code) return res.status(400).json({ message: 'Invalid 2FA code.' });
      if (Date.now() > user.two_fa_expires) return res.status(400).json({ message: '2FA code has expired.' });

      db.run('UPDATE users SET two_fa_code=NULL, two_fa_expires=NULL WHERE id=?', [user.id]);

      const token = jwt.sign(
        { sub: `${user.first_name} ${user.last_name}`.trim(), email: user.email, role: user.role },
        JWT_SECRET,
        { expiresIn: '1h' }
      );
      return res.json({
        success: true, message: 'Login successful.', token,
        user: `${user.first_name} ${user.last_name}`.trim(),
        expiry: Date.now() + 60 * 60 * 1000,
      });
    }
  );
});

// POST /api/auth/forgot-password  /  POST /api/auth/request-reset
const handleForgotPassword = async (req, res) => {
  const email = (req.body.email || req.body.username || '').trim().toLowerCase();
  if (!email) return res.status(400).json({ error: 'Email is required.', message: 'Email is required.' });

  db.get('SELECT * FROM users WHERE LOWER(email) = ?', [email], async (err, user) => {
    if (err) return res.status(500).json({ error: 'Database error.' });
    if (!user) return res.status(404).json({ error: 'No account found for that email.', message: 'No account found for that email.' });

    const code = generateCode();
    db.run('UPDATE users SET password_reset_code=? WHERE id=?', [code, user.id]);

    const username = `${user.first_name} ${user.last_name}`.trim();
    const html = `<div style="font-family:sans-serif;padding:20px;max-width:500px;margin:auto;">
      <h2 style="color:#b91c1c;">ZamboAlert Security</h2>
      <p>Hello <strong>${username}</strong>, your password reset code is:</p>
      <div style="font-size:24px;font-weight:bold;text-align:center;padding:15px;background:#fef2f2;color:#b91c1c;margin:20px 0;letter-spacing:4px;">${code}</div>
      <p style="font-size:12px;color:#6b7280;">Expires in 15 minutes. If you did not request this, ignore this email.</p>
    </div>`;
    const emailSent = await sendMail(user.email, 'Reset your ZamboAlert Password',
      `Your password reset code is: ${code}. Expires in 15 minutes.`, html, code);

    return res.json({
      success: true,
      message: emailSent ? 'Password reset code sent to your email.' : `Reset requested! Code: ${code}`,
      email: user.email,
      code: !emailSent ? code : undefined,
    });
  });
};
app.post('/api/auth/forgot-password', handleForgotPassword);
app.post('/api/auth/request-reset', handleForgotPassword);

// POST /api/auth/reset-password
app.post('/api/auth/reset-password', async (req, res) => {
  const { email, code, newPassword } = req.body;
  if (!email || !code || !newPassword) return res.status(400).json({ error: 'All fields are required.' });

  db.get('SELECT * FROM users WHERE LOWER(email) = ?', [email.trim().toLowerCase()], async (err, user) => {
    if (err) return res.status(500).json({ error: 'Database error.' });
    if (!user || user.password_reset_code !== code.trim()) {
      return res.status(400).json({ error: 'Invalid or expired recovery code.' });
    }

    const bcryptHash = await bcrypt.hash(newPassword, 10);
    db.run(
      'UPDATE users SET password_hash=?, password_bcrypt=?, password_reset_code=NULL, failed_attempts=0, is_verified=1 WHERE id=?',
      [sha256(newPassword), bcryptHash, user.id],
      updateErr => {
        if (updateErr) return res.status(500).json({ error: 'Failed to reset password.' });
        return res.json({ success: true, message: 'Password reset successfully.' });
      }
    );
  });
});

// POST /api/auth/rescuer-verify  (mobile rescuer submits ID docs)
app.post('/api/auth/rescuer-verify', (req, res) => {
  const { email, idType, idNumber, idFrontUri, idBackUri } = req.body;
  if (!email || !idType || !idNumber) return res.status(400).json({ error: 'Email, ID type, and ID number are required.' });

  db.run(
    'UPDATE users SET id_type=?, id_number=?, id_front_uri=?, id_back_uri=?, is_rescuer_verified=0 WHERE LOWER(email)=? AND role=?',
    [idType.trim(), idNumber.trim(), idFrontUri || '', idBackUri || '', email.trim().toLowerCase(), 'rescuer'],
    function (err) {
      if (err) return res.status(500).json({ error: 'Database error.' });
      if (this.changes === 0) return res.status(404).json({ error: 'Rescuer account not found.' });
      return res.json({ success: true, message: 'Verification documents submitted. Awaiting admin approval.' });
    }
  );
});

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 4: Rescuers (SQLite relational table — web admin panel)
// ══════════════════════════════════════════════════════════════════════════════

// GET /api/rescuers — includes ID photos from matching users row (by email)
app.get('/api/rescuers', (req, res) => {
  db.all(
    `SELECT r.*, u.id_front_uri AS id_front_uri, u.id_back_uri AS id_back_uri
     FROM rescuers r
     LEFT JOIN users u ON LOWER(TRIM(u.email)) = LOWER(TRIM(r.email)) AND u.role = 'rescuer'
     ORDER BY r.created_at DESC`,
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ message: 'Database query error', error: err.message });
      res.json(rows);
    }
  );
});

// GET /api/rescuers/:id — single rescuer with ID document photos for admin review
app.get('/api/rescuers/:id', (req, res) => {
  db.get(
    `SELECT r.*, u.id_front_uri AS id_front_uri, u.id_back_uri AS id_back_uri
     FROM rescuers r
     LEFT JOIN users u ON LOWER(TRIM(u.email)) = LOWER(TRIM(r.email)) AND u.role = 'rescuer'
     WHERE r.id = ?`,
    [req.params.id],
    (err, row) => {
      if (err) return res.status(500).json({ message: 'Database query error', error: err.message });
      if (!row) return res.status(404).json({ message: 'Rescuer not found.' });
      res.json(row);
    }
  );
});

// POST /api/rescuers/register — register from mobile app
app.post('/api/rescuers/register', (req, res) => {
  const { email, first_name, last_name, phone_number, id_type, id_number } = req.body;
  if (!email || !first_name || !last_name || !id_type || !id_number) {
    return res.status(400).json({ message: 'Required fields are missing.' });
  }
  db.get("SELECT value FROM settings WHERE key = 'require_rescuer_approval'", [], (err, row) => {
    const defaultVerified = (!err && row && row.value === '0') ? 1 : 0;
    const defaultStatus = defaultVerified === 1 ? 'available' : 'offline';
    db.run(
      `INSERT INTO rescuers (email, first_name, last_name, phone_number, id_type, id_number, is_verified, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [email, first_name, last_name, phone_number || null, id_type, id_number, defaultVerified, defaultStatus],
      function (insertErr) {
        if (insertErr) {
          if (insertErr.message.includes('UNIQUE')) return res.status(400).json({ message: 'Email is already registered.' });
          return res.status(500).json({ message: 'Failed to register rescuer', error: insertErr.message });
        }
        res.status(201).json({
          message: defaultVerified === 1 ? 'Rescuer registered and auto-approved.' : 'Rescuer registered. Pending admin approval.',
          rescuerId: this.lastID,
          isVerified: defaultVerified === 1,
        });
      }
    );
  });
});

// POST /api/rescuers/verify/:id
app.post('/api/rescuers/verify/:id', (req, res) => {
  const { id } = req.params;
  db.run("UPDATE rescuers SET is_verified=1, status='available' WHERE id=?", [id], function (err) {
    if (err) return res.status(500).json({ message: 'Failed to verify rescuer', error: err.message });
    if (this.changes === 0) return res.status(404).json({ message: 'Rescuer not found.' });

    // Sync to mobile users table by email
    db.get('SELECT email FROM rescuers WHERE id=?', [id], (emailErr, row) => {
      if (!emailErr && row?.email) {
        db.run('UPDATE users SET is_rescuer_verified=1 WHERE LOWER(email)=? AND role=?',
          [row.email.toLowerCase(), 'rescuer']);
      }
    });
    res.json({ message: 'Rescuer verified and approved successfully.' });
  });
});

// DELETE /api/rescuers/:id
app.delete('/api/rescuers/:id', (req, res) => {
  db.get('SELECT email FROM rescuers WHERE id=?', [req.params.id], (findErr, row) => {
    if (findErr) return res.status(500).json({ message: 'Failed to delete rescuer', error: findErr.message });
    if (!row) return res.status(404).json({ message: 'Rescuer not found.' });

    db.run('DELETE FROM rescuers WHERE id=?', [req.params.id], function (err) {
      if (err) return res.status(500).json({ message: 'Failed to delete rescuer', error: err.message });
      if (row.email) {
        db.run(
          "UPDATE users SET is_rescuer_verified=0 WHERE LOWER(email)=? AND role='rescuer'",
          [row.email.toLowerCase()]
        );
      }
      res.json({ message: 'Rescuer account rejected and deleted successfully.' });
    });
  });
});

// POST /api/rescuers/dispatch
app.post('/api/rescuers/dispatch', (req, res) => {
  const { rescuerId, targetType, targetId, targetName } = req.body;
  if (!rescuerId || !targetType) return res.status(400).json({ message: 'Rescuer ID and Target Type are required.' });
  db.run(
    "UPDATE rescuers SET status='en-route', assigned_target_type=?, assigned_target_id=?, assigned_target_name=? WHERE id=? OR id_number=?",
    [targetType, String(targetId), targetName, rescuerId, rescuerId],
    err => {
      if (err) return res.status(500).json({ message: 'Failed to dispatch rescuer', error: err.message });
      res.json({ message: 'Rescuer dispatched successfully.' });
    }
  );
});

// POST /api/rescuers/resolve/:id
app.post('/api/rescuers/resolve/:id', (req, res) => {
  const { id } = req.params;
  db.run(
    "UPDATE rescuers SET status='available', assigned_target_type=NULL, assigned_target_id=NULL, assigned_target_name=NULL WHERE id=? OR id_number=?",
    [id, id],
    err => {
      if (err) return res.status(500).json({ message: 'Failed to resolve rescuer dispatch', error: err.message });
      res.json({ message: 'Rescuer dispatch resolved successfully.' });
    }
  );
});

// POST /api/rescuers/location
app.post('/api/rescuers/location', (req, res) => {
  const { rescuerId, latitude, longitude, status } = req.body;
  if (!rescuerId || latitude === undefined || longitude === undefined) {
    return res.status(400).json({ message: 'Rescuer ID, latitude, and longitude are required.' });
  }
  let sql = 'UPDATE rescuers SET latitude=?, longitude=?';
  const params = [parseFloat(latitude), parseFloat(longitude)];
  if (status) { sql += ', status=?'; params.push(status); }
  sql += ' WHERE id=? OR id_number=?';
  params.push(rescuerId, rescuerId);
  db.run(sql, params, err => {
    if (err) return res.status(500).json({ message: 'Failed to update location', error: err.message });
    res.json({ message: 'Location updated successfully.' });
  });
});

// POST /api/rescuers/assign-zone
app.post('/api/rescuers/assign-zone', (req, res) => {
  const { rescuerId, zone, role } = req.body;
  if (!rescuerId || !zone) return res.status(400).json({ message: 'Rescuer ID and Zone are required.' });
  let sql = 'UPDATE rescuers SET assigned_zone=?';
  const params = [zone];
  if (role) { sql += ', role=?'; params.push(role); }
  sql += ' WHERE id=? OR id_number=?';
  params.push(rescuerId, rescuerId);
  db.run(sql, params, err => {
    if (err) return res.status(500).json({ message: 'Failed to assign zone', error: err.message });
    res.json({ message: `Zone updated to ${zone} successfully.` });
  });
});

// ── Legacy admin rescuers routes (mobile app uses these) ──────────────────────
app.get('/api/admin/rescuers', requireAdminKey, (req, res) => {
  // Returns users table rescuers (mobile registrations)
  db.all("SELECT * FROM users WHERE role='rescuer'", [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows.map(u => ({
      id: u.id, firstName: u.first_name, lastName: u.last_name,
      email: u.email, contactNumber: u.contact_number,
      idType: u.id_type, idNumber: u.id_number,
      idFrontUri: u.id_front_uri || null,
      idBackUri: u.id_back_uri || null,
      isRescuerVerified: u.is_rescuer_verified,
      isVerified: !!u.is_verified,
    })));
  });
});

app.post('/api/admin/rescuers/:id/approve', requireAdminKey, (req, res) => {
  db.run('UPDATE users SET is_rescuer_verified=1 WHERE id=? AND role=?', [req.params.id, 'rescuer'], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: 'Rescuer account not found.' });
    res.json({ success: true, message: 'Rescuer approved successfully.' });
  });
});

app.post('/api/admin/rescuers/approve-by-email', (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'email is required.' });
  db.run("UPDATE users SET is_rescuer_verified=1 WHERE LOWER(email)=? AND role='rescuer'",
    [email.trim().toLowerCase()],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(404).json({ error: 'Rescuer account not found.' });
      res.json({ success: true, message: 'Rescuer approved and synced.' });
    }
  );
});

app.post('/api/admin/rescuers/:id/reject', requireAdminKey, (req, res) => {
  db.run('UPDATE users SET is_rescuer_verified=0 WHERE id=? AND role=?', [req.params.id, 'rescuer'], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: 'Rescuer account not found.' });
    res.json({ success: true, message: 'Rescuer status set to rejected/pending.' });
  });
});

app.get('/api/admin/stats', requireAdminKey, (req, res) => {
  db.all('SELECT role, is_rescuer_verified FROM users', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    const totalCitizens = rows.filter(u => u.role === 'citizen').length;
    const rescuers = rows.filter(u => u.role === 'rescuer');
    res.json({
      totalCitizens,
      totalRescuers: rescuers.length,
      pendingRescuers: rescuers.filter(u => !u.is_rescuer_verified).length,
      approvedRescuers: rescuers.filter(u => u.is_rescuer_verified === 1).length,
    });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 5: Settings
// ══════════════════════════════════════════════════════════════════════════════

app.get('/api/settings', (req, res) => {
  db.all('SELECT * FROM settings', [], (err, rows) => {
    if (err) return res.status(500).json({ message: 'Failed to fetch settings', error: err.message });
    const out = {};
    rows.forEach(r => {
      if (r.key === 'require_rescuer_approval') out.requireRescuerApproval = r.value === '1';
      else out[r.key] = r.value;
    });
    if (out.requireRescuerApproval === undefined) out.requireRescuerApproval = true;
    res.json(out);
  });
});

app.post('/api/settings', (req, res) => {
  const { key, value } = req.body;
  if (!key) return res.status(400).json({ message: 'Setting key is required.' });
  const valStr = typeof value === 'boolean' ? (value ? '1' : '0') : String(value);
  db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, valStr], err => {
    if (err) return res.status(500).json({ message: 'Failed to save setting', error: err.message });
    res.json({ message: 'Setting saved successfully.', key, value });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 6: Casualty / Victim Logs
// ══════════════════════════════════════════════════════════════════════════════

app.get('/api/logs/casualties', (req, res) => {
  db.all('SELECT * FROM casualty_logs ORDER BY created_at DESC', [], (err, rows) => {
    if (err) return res.status(500).json({ message: 'Database query error', error: err.message });
    res.json(rows);
  });
});

app.post('/api/logs/casualties', (req, res) => {
  const { rescuer_id, rescuer_name, victim_name, age, gender, status, injury_details, location, latitude, longitude, disaster_type } = req.body;
  if (!victim_name || !status) return res.status(400).json({ message: 'Victim name and status are required.' });
  db.run(
    `INSERT INTO casualty_logs (rescuer_id, rescuer_name, victim_name, age, gender, status, injury_details, location, latitude, longitude, disaster_type)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [rescuer_id||null, rescuer_name||null, victim_name, age?parseInt(age):null, gender||'Unknown',
     status, injury_details||null, location||null, latitude?parseFloat(latitude):null, longitude?parseFloat(longitude):null, disaster_type||'Unknown'],
    function (err) {
      if (err) return res.status(500).json({ message: 'Failed to insert log', error: err.message });
      res.status(201).json({ message: 'Casualty/Victim log recorded successfully', logId: this.lastID });
    }
  );
});

app.post('/api/logs/casualties/clear', (req, res) => {
  db.run('DELETE FROM casualty_logs', [], err => {
    if (err) return res.status(500).json({ message: 'Failed to clear casualty logs', error: err.message });
    res.json({ message: 'All casualty logs cleared.' });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 7: Households / Resident Registry
// ══════════════════════════════════════════════════════════════════════════════

app.get('/api/households', (req, res) => {
  const { purok } = req.query;
  let sql = 'SELECT * FROM households';
  const params = [];
  if (purok && purok !== 'ALL') { sql += ' WHERE purok_zone=?'; params.push(purok); }
  sql += ' ORDER BY created_at DESC';
  db.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ message: 'Database query error', error: err.message });
    res.json(rows);
  });
});

app.post('/api/households', (req, res) => {
  const { resident_name, household_head, phone_number, purok_zone, occupants_count, vulnerable_count, status, latitude, longitude } = req.body;
  if (!resident_name || !phone_number || !purok_zone) {
    return res.status(400).json({ message: 'Resident Name, Phone Number, and Purok/Zone are required.' });
  }
  db.run(
    `INSERT INTO households (resident_name, household_head, phone_number, purok_zone, occupants_count, vulnerable_count, status, latitude, longitude)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [resident_name, household_head||resident_name, phone_number, purok_zone,
     occupants_count?parseInt(occupants_count):1, vulnerable_count?parseInt(vulnerable_count):0,
     status||'Active', latitude?parseFloat(latitude):null, longitude?parseFloat(longitude):null],
    function (err) {
      if (err) return res.status(500).json({ message: 'Failed to add household record', error: err.message });
      res.status(201).json({ message: 'Household registered successfully', householdId: this.lastID });
    }
  );
});

app.put('/api/households/:id', (req, res) => {
  const { id } = req.params;
  const { resident_name, household_head, phone_number, purok_zone, occupants_count, vulnerable_count, status, latitude, longitude } = req.body;
  db.run(
    `UPDATE households SET resident_name=?, household_head=?, phone_number=?, purok_zone=?,
     occupants_count=?, vulnerable_count=?, status=?, latitude=?, longitude=? WHERE id=?`,
    [resident_name, household_head, phone_number, purok_zone,
     parseInt(occupants_count||1), parseInt(vulnerable_count||0), status,
     latitude?parseFloat(latitude):null, longitude?parseFloat(longitude):null, id],
    err => {
      if (err) return res.status(500).json({ message: 'Failed to update household', error: err.message });
      res.json({ message: 'Household updated successfully.' });
    }
  );
});

app.delete('/api/households/:id', (req, res) => {
  db.run('DELETE FROM households WHERE id=?', [req.params.id], err => {
    if (err) return res.status(500).json({ message: 'Failed to delete household', error: err.message });
    res.json({ message: 'Household record deleted.' });
  });
});

app.post('/api/households/broadcast', (req, res) => {
  const { purok_zone, message, priority } = req.body;
  if (!message) return res.status(400).json({ message: 'Broadcast message is required.' });
  let sql = "SELECT phone_number, resident_name FROM households WHERE status='Active'";
  const params = [];
  if (purok_zone && purok_zone !== 'ALL') { sql += ' AND purok_zone=?'; params.push(purok_zone); }
  db.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ message: 'Database query error', error: err.message });
    console.log(`[BROADCAST] ${rows.length} households (${purok_zone||'All Zones'}): "${message}"`);
    res.json({
      message: `SMS alert transmitted to ${rows.length} registered household contact(s).`,
      recipientsCount: rows.length, timestamp: new Date().toISOString(),
    });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 8: Incidents & Analytics
// ══════════════════════════════════════════════════════════════════════════════

// NOTE: /api/incidents/export must be declared BEFORE /api/incidents/:id
app.get('/api/incidents/export', (req, res) => {
  db.all('SELECT * FROM incidents ORDER BY date_occurred DESC', [], (err, rows) => {
    if (err) return res.status(500).json({ message: 'Database query error', error: err.message });
    const headers = ["ID","Title","Disaster Type","Date Occurred","Peak Water Level (m)","Affected Households",
      "Total Rescued","Casualties","Avg Response Time (min)","Dispatch Time (min)","On Scene Time (min)",
      "Purok/Zone","Damage Estimate (PHP)","Status","Summary"];
    const csvRows = [headers.join(',')];
    rows.forEach(r => {
      csvRows.push([
        r.id, `"${(r.title||'').replace(/"/g,'""')}"`, r.disaster_type, r.date_occurred,
        r.water_level_m||0, r.affected_households||0, r.total_rescued||0, r.casualties_count||0,
        r.avg_response_time_mins||0, r.dispatch_time_mins||0, r.on_scene_time_mins||0,
        `"${(r.purok_zone||'').replace(/"/g,'""')}"`, r.damage_estimate_php||0, r.status,
        `"${(r.summary_notes||'').replace(/"/g,'""')}"`
      ].join(','));
    });
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="ZamboAlert_ZCDRRMO_Incident_Analytics_Report.csv"');
    res.send(csvRows.join('\n'));
  });
});

app.get('/api/incidents', (req, res) => {
  db.all('SELECT * FROM incidents ORDER BY date_occurred DESC', [], (err, rows) => {
    if (err) return res.status(500).json({ message: 'Database query error', error: err.message });
    res.json(rows);
  });
});

app.post('/api/incidents', (req, res) => {
  const { title, disaster_type, date_occurred, water_level_m, affected_households, total_rescued,
    casualties_count, avg_response_time_mins, dispatch_time_mins, on_scene_time_mins,
    purok_zone, damage_estimate_php, status, summary_notes } = req.body;
  if (!title || !date_occurred) return res.status(400).json({ message: 'Title and Date Occurred are required.' });
  db.run(
    `INSERT INTO incidents (title, disaster_type, date_occurred, water_level_m, affected_households, total_rescued,
     casualties_count, avg_response_time_mins, dispatch_time_mins, on_scene_time_mins, purok_zone,
     damage_estimate_php, status, summary_notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [title, disaster_type||'Flood', date_occurred, water_level_m?parseFloat(water_level_m):null,
     affected_households?parseInt(affected_households):0, total_rescued?parseInt(total_rescued):0,
     casualties_count?parseInt(casualties_count):0, avg_response_time_mins?parseInt(avg_response_time_mins):15,
     dispatch_time_mins?parseFloat(dispatch_time_mins):4.0, on_scene_time_mins?parseFloat(on_scene_time_mins):11.0,
     purok_zone||'Barangay Wide', damage_estimate_php?parseFloat(damage_estimate_php):0.0,
     status||'Closed', summary_notes||null],
    function (err) {
      if (err) return res.status(500).json({ message: 'Failed to insert incident report', error: err.message });
      res.status(201).json({ message: 'Incident report recorded successfully', incidentId: this.lastID });
    }
  );
});

app.delete('/api/incidents/:id', (req, res) => {
  db.run('DELETE FROM incidents WHERE id=?', [req.params.id], err => {
    if (err) return res.status(500).json({ message: 'Failed to delete incident report', error: err.message });
    res.json({ message: 'Incident report deleted.' });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 9: Manpower & Worst-Case Disaster Scenarios
// ══════════════════════════════════════════════════════════════════════════════

app.get('/api/manpower/barangays', (req, res) => {
  db.all("SELECT * FROM barangays ORDER BY risk_level='Extreme' DESC, risk_level='High' DESC, name ASC", [], (err, rows) => {
    if (err) return res.status(500).json({ message: 'Database query error', error: err.message });
    res.json(rows);
  });
});

app.put('/api/manpower/barangays/:id', (req, res) => {
  const { active_sar, active_tanods, active_medics, active_logistics, active_boat_crews, rescue_boats, ambulances, contact_person, contact_number } = req.body;
  db.run(
    `UPDATE barangays SET active_sar=?, active_tanods=?, active_medics=?, active_logistics=?,
     active_boat_crews=?, rescue_boats=?, ambulances=?, contact_person=?, contact_number=? WHERE id=?`,
    [parseInt(active_sar||0), parseInt(active_tanods||0), parseInt(active_medics||0), parseInt(active_logistics||0),
     parseInt(active_boat_crews||0), parseInt(rescue_boats||0), parseInt(ambulances||0), contact_person, contact_number, req.params.id],
    err => {
      if (err) return res.status(500).json({ message: 'Failed to update barangay manpower', error: err.message });
      res.json({ message: 'Barangay manpower inventory updated successfully.' });
    }
  );
});

app.get('/api/manpower/alerts', (req, res) => {
  db.all('SELECT * FROM manpower_alerts ORDER BY deficit_percentage DESC, deficit_count DESC', [], (err, rows) => {
    if (err) return res.status(500).json({ message: 'Database query error', error: err.message });
    res.json(rows);
  });
});

app.post('/api/manpower/alerts', (req, res) => {
  const {
    barangay_id, barangay_name, disaster_type='Flash Flood', scenario_level='Level 3 - Severe Disaster',
    projected_affected_pop=0, required_sar=0, required_tanods=0, required_medics=0, required_logistics=0,
    required_total, available_total=0, deficit_count, deficit_percentage, alert_level,
    status='Active', mobilization_status='Pending Mobilization', triggered_by='Command Center Manual Trigger',
  } = req.body;
  if (!barangay_name) return res.status(400).json({ message: 'Barangay name is required.' });

  const reqTotal = required_total !== undefined
    ? Number(required_total)
    : Number(required_sar) + Number(required_tanods) + Number(required_medics) + Number(required_logistics);
  const availTotal = Number(available_total);
  const defCount = deficit_count !== undefined ? Number(deficit_count) : Math.max(0, reqTotal - availTotal);
  const defPct = deficit_percentage !== undefined
    ? Number(deficit_percentage)
    : (reqTotal > 0 ? parseFloat(((defCount / reqTotal) * 100).toFixed(1)) : 0);

  let calculatedLevel = alert_level;
  if (!calculatedLevel) {
    if (defPct >= 50 || defCount >= 40) calculatedLevel = 'CRITICAL RED';
    else if (defPct >= 30 || defCount >= 20) calculatedLevel = 'SEVERE ORANGE';
    else if (defPct >= 15 || defCount >= 10) calculatedLevel = 'MODERATE YELLOW';
    else calculatedLevel = 'SUFFICIENT GREEN';
  }

  db.run(
    `INSERT INTO manpower_alerts (barangay_id, barangay_name, disaster_type, scenario_level, projected_affected_pop,
     required_sar, required_tanods, required_medics, required_logistics, required_total, available_total,
     deficit_count, deficit_percentage, alert_level, status, mobilization_status, triggered_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [barangay_id||null, barangay_name.trim(), disaster_type, scenario_level, Number(projected_affected_pop),
     Number(required_sar), Number(required_tanods), Number(required_medics), Number(required_logistics),
     reqTotal, availTotal, defCount, defPct, calculatedLevel, status, mobilization_status, triggered_by],
    function (err) {
      if (err) return res.status(500).json({ message: 'Failed to record manpower alert', error: err.message });
      res.status(201).json({ message: 'Manpower alert recorded successfully.', alertId: this.lastID,
        barangay_name, alert_level: calculatedLevel, deficit_count: defCount, deficit_percentage: defPct });
    }
  );
});

app.post('/api/manpower/trigger-alert', (req, res) => {
  const { barangay_name, custom_message } = req.body;
  if (!barangay_name) return res.status(400).json({ message: 'Barangay Name is required.' });
  db.run(
    "UPDATE manpower_alerts SET alert_level='CRITICAL RED', mobilization_status='Emergency Mobilization Broadcast Sent' WHERE barangay_name=?",
    [barangay_name],
    err => {
      if (err) return res.status(500).json({ message: 'Failed to update alert state', error: err.message });
      console.log(`[MANPOWER RED ALERT] Barangay ${barangay_name}: "${custom_message || 'ALL UNITS REPORT IMMEDIATELY.'}"`);
      res.json({ message: `Emergency Red Alert triggered for Barangay ${barangay_name}.`, barangay_name, timestamp: new Date().toISOString() });
    }
  );
});

app.post('/api/manpower/mutual-aid-transfer', (req, res) => {
  const { from_barangay, to_barangay, disaster_type, sar_count=0, tanod_count=0, medic_count=0, logistics_count=0, notes } = req.body;
  if (!from_barangay || !to_barangay) return res.status(400).json({ message: 'Source and Destination Barangay are required.' });
  const total = parseInt(sar_count||0) + parseInt(tanod_count||0) + parseInt(medic_count||0) + parseInt(logistics_count||0);
  if (total <= 0) return res.status(400).json({ message: 'At least 1 personnel must be selected for transfer.' });
  db.run(
    `INSERT INTO manpower_transfers (from_barangay, to_barangay, disaster_type, sar_count, tanod_count, medic_count, logistics_count, total_personnel, status, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'En-Route', ?)`,
    [from_barangay, to_barangay, disaster_type||'Flash Flood', parseInt(sar_count||0), parseInt(tanod_count||0),
     parseInt(medic_count||0), parseInt(logistics_count||0), total, notes||`Mutual Aid from ${from_barangay} to ${to_barangay}`],
    function (err) {
      if (err) return res.status(500).json({ message: 'Failed to record mutual aid transfer', error: err.message });
      db.run("UPDATE manpower_alerts SET mobilization_status='Mutual Aid Reinforcements En-Route' WHERE barangay_name=?", [to_barangay]);
      res.status(201).json({ message: `${total} personnel dispatched from ${from_barangay} to ${to_barangay}.`, transferId: this.lastID, total_personnel: total });
    }
  );
});

app.get('/api/manpower/transfers', (req, res) => {
  db.all('SELECT * FROM manpower_transfers ORDER BY created_at DESC', [], (err, rows) => {
    if (err) return res.status(500).json({ message: 'Database query error', error: err.message });
    res.json(rows);
  });
});

app.post('/api/manpower/escalate-agency', (req, res) => {
  const { target_barangays, disaster_type, scenario_level, requested_agency, requested_units, total_reinforcements, priority='Critical Priority', notes } = req.body;
  if (!target_barangays || !requested_agency || !requested_units) {
    return res.status(400).json({ message: 'Target Barangays, Requested Agency, and Requested Units are required.' });
  }
  const refNo = `ESC-ZCD-${Math.floor(1000 + Math.random() * 9000)}`;
  db.run(
    `INSERT INTO manpower_escalations (reference_no, target_barangays, disaster_type, scenario_level, requested_agency, requested_units, total_reinforcements, priority, notes, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Acknowledged & Dispatched')`,
    [refNo, Array.isArray(target_barangays) ? target_barangays.join(', ') : target_barangays,
     disaster_type||'Flash Flood', scenario_level||'Level 4 - Worst-Case Catastrophe',
     requested_agency, requested_units, parseInt(total_reinforcements||10), priority, notes||'Emergency Disaster Augmentation Requisition'],
    function (err) {
      if (err) return res.status(500).json({ message: 'Failed to record agency escalation', error: err.message });
      res.status(201).json({ message: `Escalation transmitted to ${requested_agency}. Reference: ${refNo}`, reference_no: refNo, escalationId: this.lastID });
    }
  );
});

app.get('/api/manpower/escalations', (req, res) => {
  db.all('SELECT * FROM manpower_escalations ORDER BY created_at DESC', [], (err, rows) => {
    if (err) return res.status(500).json({ message: 'Database query error', error: err.message });
    res.json(rows);
  });
});

// NOTE: /api/manpower/export must be declared BEFORE /api/manpower/:id if you had one
app.get('/api/manpower/export', (req, res) => {
  db.all(
    `SELECT a.*, b.population, b.district, b.risk_level, b.rescue_boats, b.ambulances, b.contact_person, b.contact_number
     FROM manpower_alerts a LEFT JOIN barangays b ON a.barangay_name = b.name
     ORDER BY a.deficit_percentage DESC`,
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ message: 'Database query error', error: err.message });
      const headers = ["Alert ID","Barangay","District","Population","Vulnerability Risk","Disaster Scenario",
        "Scenario Level","Projected Affected Pop","Required SAR","Required Tanods","Required Medics",
        "Required Logistics","Total Required Manpower","Available Manpower","Deficit Count (Shortage)",
        "Deficit %","Alert Level","Mobilization Status","Rescue Boats","Ambulances","Contact Person","Contact Number"];
      const csvRows = [headers.join(',')];
      rows.forEach(r => {
        csvRows.push([
          r.id, `"${(r.barangay_name||'').replace(/"/g,'""')}"`, `"${(r.district||'').replace(/"/g,'""')}"`,
          r.population||0, r.risk_level||'High', `"${(r.disaster_type||'').replace(/"/g,'""')}"`,
          `"${(r.scenario_level||'').replace(/"/g,'""')}"`, r.projected_affected_pop||0,
          r.required_sar||0, r.required_tanods||0, r.required_medics||0, r.required_logistics||0,
          r.required_total||0, r.available_total||0, r.deficit_count||0,
          `${r.deficit_percentage||0}%`, r.alert_level||'CRITICAL RED',
          `"${(r.mobilization_status||'').replace(/"/g,'""')}"`,
          r.rescue_boats||0, r.ambulances||0,
          `"${(r.contact_person||'').replace(/"/g,'""')}"`, `"${(r.contact_number||'').replace(/"/g,'""')}"`
        ].join(','));
      });
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="ZCDRRMO_Worst_Case_Disaster_Manpower_Alert_Report.csv"');
      res.send(csvRows.join('\n'));
    }
  );
});

// ── Start server ──────────────────────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚨 ZamboAlert Unified Backend running on http://0.0.0.0:${PORT}`);
  console.log(`   LoRa telemetry, Citizen SOS, Mobile Auth, Web Admin API — all on :${PORT}`);
  console.log(`   SQLite DB: ${require('./database').db ? 'connected' : 'initializing...'}\n`);
});
