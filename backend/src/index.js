const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
require('dotenv').config();
const app = express();
const PORT = Number(process.env.PORT || 3000);
const VERIFICATION_CODE_TTL_MS = 10 * 60 * 1000;

// Path to JSON database
const DB_PATH = process.env.ZAMBOALERT_DB_PATH || path.join(__dirname, 'db.json');

// Middleware for parsing JSON and form bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Custom CORS middleware to avoid cross-origin request issues from mobile devices/emulators
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-Gateway-Key');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Serve static files for the Admin dashboard from the public folder
app.use(express.static(path.join(__dirname, '../public')));

// ── Database Helper Functions ────────────────────────────────────────────────
function readDB() {
  try {
    if (!fs.existsSync(DB_PATH)) {
      return { users: [] };
    }
    const data = fs.readFileSync(DB_PATH, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading DB:', error);
    return { users: [] };
  }
}

function writeDB(data) {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf8');
  } catch (error) {
    console.error('Error writing DB:', error);
    throw error;
  }
}

// Health Check for Render / Cloud monitors
app.get('/health', (req, res) => {
  return res.status(200).json({ status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() });
});

app.post('/api/telemetry', (req, res) => {
  const expectedKey = process.env.GATEWAY_API_KEY || '';
  const suppliedKey = req.get('X-Gateway-Key') || '';
  const suppliedBuffer = Buffer.from(suppliedKey);
  const expectedBuffer = Buffer.from(expectedKey);

  if (!expectedKey) {
    return res.status(503).json({ message: 'Gateway telemetry is not configured on this server.' });
  }
  if (suppliedBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(suppliedBuffer, expectedBuffer)) {
    return res.status(401).json({ message: 'Invalid gateway key.' });
  }

  const body = req.body || {};
  const validNumber = (value, min, max) =>
    typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
  const nodeId = typeof body.nodeId === 'string' ? body.nodeId.toUpperCase() : '';
  const gatewayId = typeof body.gatewayId === 'string' ? body.gatewayId : '';
  const fix = body.fix === true;
  const valid =
    /^[0-9A-F]{1,8}$/.test(nodeId) &&
    gatewayId.length > 0 &&
    gatewayId.length <= 40 &&
    Number.isInteger(body.seq) && body.seq >= 0 && body.seq <= 4294967295 &&
    [0, 1].includes(body.msgType) &&
    typeof body.fix === 'boolean' &&
    (!fix || (validNumber(body.lat, -90, 90) && validNumber(body.lng, -180, 180))) &&
    validNumber(body.gatewayLat, -90, 90) &&
    validNumber(body.gatewayLng, -180, 180) &&
    Number.isInteger(body.sats) && body.sats >= 0 && body.sats <= 255 &&
    Number.isInteger(body.bleVictims) && body.bleVictims >= 0 && body.bleVictims <= 255 &&
    Number.isInteger(body.nearestRssi) && body.nearestRssi >= -127 && body.nearestRssi <= 0 &&
    typeof body.nearestVictimId === 'string' && /^[A-Za-z0-9_]{0,8}$/.test(body.nearestVictimId) &&
    Number.isInteger(body.victimStatus) && body.victimStatus >= 0 && body.victimStatus <= 255 &&
    Number.isInteger(body.hopCount) && body.hopCount >= 0 && body.hopCount <= 255 &&
    Number.isInteger(body.uptime) && body.uptime >= 0 && body.uptime <= 4294967295 &&
    Number.isInteger(body.loraRssi) && body.loraRssi >= -127 && body.loraRssi <= 0 &&
    validNumber(body.loraSnr, -50, 50);

  if (!valid) {
    return res.status(400).json({ message: 'Invalid telemetry packet.' });
  }

  try {
    const db = readDB();
    const telemetry = Array.isArray(db.podTelemetry) ? db.podTelemetry : [];
    const receivedAt = new Date().toISOString();
    const report = {
      nodeId,
      gatewayId,
      seq: body.seq,
      msgType: body.msgType,
      fix,
      lat: fix ? body.lat : null,
      lng: fix ? body.lng : null,
      gatewayLat: body.gatewayLat,
      gatewayLng: body.gatewayLng,
      sats: body.sats,
      bleVictims: body.bleVictims,
      nearestRssi: body.nearestRssi,
      nearestVictimId: body.nearestVictimId,
      victimStatus: body.victimStatus,
      hopCount: body.hopCount,
      uptime: body.uptime,
      loraRssi: body.loraRssi,
      loraSnr: body.loraSnr,
      receivedAt,
    };
    const existingIndex = telemetry.findIndex((item) => item.nodeId === nodeId);
    if (existingIndex === -1) {
      telemetry.push(report);
    } else {
      telemetry[existingIndex] = report;
    }
    db.podTelemetry = telemetry;
    writeDB(db);
    return res.status(202).json({ message: 'Telemetry received.', nodeId });
  } catch (error) {
    console.error('Failed to store gateway telemetry:', error.message);
    return res.status(500).json({ message: 'Failed to store gateway telemetry.' });
  }
});

app.get('/api/telemetry', (req, res) => {
  const podCutoff = Date.now() - 90 * 1000;            // hardware pods: 90 s
  const citizenCutoff = Date.now() - 10 * 60 * 1000;  // citizen app virtual pods: 10 min (matches /api/sos TTL)
  const telemetry = readDB().podTelemetry;
  const reports = Array.isArray(telemetry) ? telemetry : [];
  return res.json(
    reports
      .filter((report) => {
        const receivedAt = Date.parse(report.receivedAt);
        if (!Number.isFinite(receivedAt)) return false;
        // Virtual pods injected from citizen app use the longer citizen SOS TTL
        const cutoff = report.gatewayId === 'CITIZEN-APP-GATEWAY' ? citizenCutoff : podCutoff;
        return receivedAt >= cutoff;
      })
      .sort((a, b) => Date.parse(b.receivedAt) - Date.parse(a.receivedAt)),
  );
});

// ── Citizen phone SOS (HTTP GPS for web map — LAN or cloud) ───────────────────
const CITIZEN_SOS_TTL_MS = 10 * 60 * 1000;
const DISASTER_TYPES = new Set(['earthquake', 'flood', 'fire', 'landslide']);

app.post('/api/sos', (req, res) => {
  const body = req.body || {};
  const validNumber = (value, min, max) =>
    typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;

  const clientId = typeof body.clientId === 'string' ? body.clientId.trim().slice(0, 64) : '';
  const name = typeof body.name === 'string' ? body.name.trim().slice(0, 80) : 'Citizen';
  const disasterType =
    typeof body.disasterType === 'string' ? body.disasterType.trim().toLowerCase() : '';

  if (
    !clientId ||
    !validNumber(body.lat, -90, 90) ||
    !validNumber(body.lng, -180, 180) ||
    !DISASTER_TYPES.has(disasterType)
  ) {
    return res.status(400).json({ message: 'Invalid citizen SOS payload.' });
  }

  try {
    const db = readDB();
    const list = Array.isArray(db.citizenSos) ? db.citizenSos : [];
    const receivedAt = new Date().toISOString();
    const report = {
      id: `SOS-${clientId.slice(0, 8).toUpperCase()}`,
      clientId,
      name: name || 'Citizen',
      lat: body.lat,
      lng: body.lng,
      disasterType,
      status: 'active',
      receivedAt,
    };
    const existingIndex = list.findIndex((item) => item.clientId === clientId);
    if (existingIndex === -1) {
      list.push(report);
    } else {
      list[existingIndex] = report;
    }
    db.citizenSos = list;

    // Mirror to podTelemetry as a virtual direct-beacon pod for rescuer app and web maps
    const telemetry = Array.isArray(db.podTelemetry) ? db.podTelemetry : [];
    const virtualNodeId = crypto.createHash('md5').update(clientId).digest('hex').slice(0, 6).toUpperCase();
    const virtualPod = {
      nodeId: virtualNodeId,
      gatewayId: 'CITIZEN-APP-GATEWAY',
      seq: 1,
      msgType: 1, // SOS
      fix: true,
      lat: body.lat,
      lng: body.lng,
      gatewayLat: body.lat,
      gatewayLng: body.lng,
      sats: 12,
      bleVictims: 1,
      nearestRssi: -45,
      nearestVictimId: clientId.slice(0, 8).toUpperCase(),
      victimStatus: 3, // trapped
      hopCount: 0,
      uptime: 60,
      loraRssi: -50,
      loraSnr: 9.0,
      receivedAt,
    };
    const existingPodIdx = telemetry.findIndex((p) => p.nodeId === virtualNodeId);
    if (existingPodIdx === -1) {
      telemetry.push(virtualPod);
    } else {
      telemetry[existingPodIdx] = virtualPod;
    }
    db.podTelemetry = telemetry;

    writeDB(db);
    return res.status(202).json({ message: 'Citizen SOS received.', id: report.id, clientId, virtualNodeId });
  } catch (error) {
    console.error('Failed to store citizen SOS:', error.message);
    return res.status(500).json({ message: 'Failed to store citizen SOS.' });
  }
});

app.get('/api/sos', (req, res) => {
  const cutoff = Date.now() - CITIZEN_SOS_TTL_MS;
  const list = readDB().citizenSos;
  const reports = Array.isArray(list) ? list : [];
  return res.json(
    reports
      .filter((report) => {
        if (report.status !== 'active') return false;
        const receivedAt = Date.parse(report.receivedAt);
        return Number.isFinite(receivedAt) && receivedAt >= cutoff;
      })
      .sort((a, b) => Date.parse(b.receivedAt) - Date.parse(a.receivedAt)),
  );
});

app.delete('/api/sos', (req, res) => {
  const body = req.body || {};
  const clientId =
    (typeof body.clientId === 'string' && body.clientId.trim()) ||
    (typeof req.query.clientId === 'string' && req.query.clientId.trim()) ||
    '';

  if (!clientId) {
    return res.status(400).json({ message: 'clientId is required.' });
  }

  try {
    const db = readDB();
    const list = Array.isArray(db.citizenSos) ? db.citizenSos : [];
    db.citizenSos = list.filter((item) => item.clientId !== clientId);

    const virtualNodeId = crypto.createHash('md5').update(clientId).digest('hex').slice(0, 6).toUpperCase();
    if (Array.isArray(db.podTelemetry)) {
      db.podTelemetry = db.podTelemetry.filter((p) => p.nodeId !== virtualNodeId);
    }

    writeDB(db);
    return res.status(200).json({ message: 'Citizen SOS cleared.', clientId });
  } catch (error) {
    console.error('Failed to clear citizen SOS:', error.message);
    return res.status(500).json({ message: 'Failed to clear citizen SOS.' });
  }
});

// ── Custom SHA-256 Hashing Algorithm ─────────────────────────────────────────
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
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ];
  let asciiLength = ascii.length;
  let asciiBitLength = asciiLength * 8;
  let words = [];
  for (let i = 0; i < asciiLength; i++) {
    words[i >> 2] |= ascii.charCodeAt(i) << (24 - (i % 4) * 8);
  }
  words[asciiLength >> 2] |= 0x80 << (24 - (asciiLength % 4) * 8);
  let wordCount = ((asciiLength + 8) >> 6) * 16 + 16;
  while (words.length < wordCount) words.push(0);
  words[wordCount - 1] = asciiBitLength;

  for (let i = 0; i < wordCount; i += 16) {
    let w = [];
    for (let j = 0; j < 16; j++) w[j] = words[i + j];
    for (let j = 16; j < 64; j++) {
      let s0 = rightRotate(w[j - 15], 7) ^ rightRotate(w[j - 15], 18) ^ (w[j - 15] >>> 3);
      let s1 = rightRotate(w[j - 2], 17) ^ rightRotate(w[j - 2], 19) ^ (w[j - 2] >>> 10);
      w[j] = (w[j - 16] + s0 + w[j - 7] + s1) | 0;
    }
    let a = hash[0], b = hash[1], c = hash[2], d = hash[3];
    let e = hash[4], f = hash[5], g = hash[6], h = hash[7];
    for (let j = 0; j < 64; j++) {
      let S1 = rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25);
      let ch = (e & f) ^ (~e & g);
      let temp1 = (h + S1 + ch + K[j] + w[j]) | 0;
      let S0 = rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22);
      let maj = (a & b) ^ (a & c) ^ (b & c);
      let temp2 = (S0 + maj) | 0;
      h = g; g = f; f = e; e = (d + temp1) | 0;
      d = c; c = b; b = a; a = (temp1 + temp2) | 0;
    }
    hash[0] = (hash[0] + a) | 0; hash[1] = (hash[1] + b) | 0;
    hash[2] = (hash[2] + c) | 0; hash[3] = (hash[3] + d) | 0;
    hash[4] = (hash[4] + e) | 0; hash[5] = (hash[5] + f) | 0;
    hash[6] = (hash[6] + g) | 0; hash[7] = (hash[7] + h) | 0;
  }
  return hash.map(val => {
    let hex = (val >>> 0).toString(16);
    return "00000000".substring(hex.length) + hex;
  }).join("");
}

function generateCode() {
  return crypto.randomInt(100000, 1000000).toString();
}

async function sendPasswordResetEmail(email, code) {
  const gmailUser = process.env.GMAIL_USER;
  const gmailAppPassword = process.env.GMAIL_APP_PASSWORD?.replace(/\s/g, '');
  if (!gmailUser || !gmailAppPassword) {
    throw new Error('GMAIL_USER and GMAIL_APP_PASSWORD must be configured.');
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: gmailUser, pass: gmailAppPassword },
    connectionTimeout: 7000,
    greetingTimeout: 7000,
    socketTimeout: 12000
  });

  await transporter.sendMail({
    from: `"ZamboAlert" <${gmailUser}>`,
    to: email,
    subject: 'Your ZamboAlert password reset code',
    text: `Your ZamboAlert password reset code is ${code}. It expires in 10 minutes. If you did not request a password reset, you can ignore this email.`,
    html: `<p>Your ZamboAlert password reset code is:</p><p style="font-size:24px;font-weight:bold;letter-spacing:6px">${code}</p><p>This code expires in 10 minutes. If you did not request a password reset, you can ignore this email.</p>`
  });
}

async function sendVerificationEmail(email, code) {
  const gmailUser = process.env.GMAIL_USER;
  const gmailAppPassword = process.env.GMAIL_APP_PASSWORD?.replace(/\s/g, '');
  if (!gmailUser || !gmailAppPassword) {
    throw new Error('GMAIL_USER and GMAIL_APP_PASSWORD must be configured.');
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: gmailUser, pass: gmailAppPassword },
    connectionTimeout: 7000,
    greetingTimeout: 7000,
    socketTimeout: 12000
  });

  await transporter.sendMail({
    from: `"ZamboAlert" <${gmailUser}>`,
    to: email,
    subject: 'Your ZamboAlert verification code',
    text: `Your ZamboAlert email verification code is ${code}. It expires in 10 minutes. If you did not create this account, you can ignore this email.`,
    html: `<p>Your ZamboAlert email verification code is:</p><p style="font-size:24px;font-weight:bold;letter-spacing:6px">${code}</p><p>This code expires in 10 minutes. If you did not create this account, you can ignore this email.</p>`
  });
}

// ── Authentication API Routes ────────────────────────────────────────────────

// SignUp Endpoint
app.post('/api/auth/signup', async (req, res) => {
  const { firstName, lastName, email, password, role, contactNumber, idType, idNumber, idFrontUri, idBackUri } = req.body;
  
  if (!firstName || !lastName || !email || !password || !role || !contactNumber) {
    return res.status(400).json({ error: 'All primary fields are required.' });
  }

  const db = readDB();
  const existing = db.users.find(u => u.email.toLowerCase() === email.trim().toLowerCase());
  
  if (existing) {
    return res.status(400).json({ error: 'An account with this email already exists. Try logging in.' });
  }

  const code = generateCode();
  const newUser = {
    id: String(Date.now()),
    firstName: firstName.trim(),
    lastName: lastName.trim(),
    email: email.trim().toLowerCase(),
    passwordHash: sha256(password), // Store password as custom sha256 hash
    role: role,
    failedAttempts: 0,
    isVerified: false,
    mfaEnabled: false,
    mfaSecret: '',
    contactNumber: contactNumber.trim(),
    emailVerificationCodeHash: sha256(code),
    emailVerificationExpiresAt: Date.now() + VERIFICATION_CODE_TTL_MS,
    idType: role === 'rescuer' ? idType : undefined,
    idNumber: role === 'rescuer' ? idNumber : undefined,
    isRescuerVerified: role === 'rescuer' ? false : undefined,
    idFrontUri: role === 'rescuer' ? idFrontUri : undefined,
    idBackUri: role === 'rescuer' ? idBackUri : undefined
  };

  try {
    await sendVerificationEmail(newUser.email, code);
  } catch (error) {
    console.error('Failed to send signup verification email:', error.message);
    return res.status(503).json({
      error: 'We could not send a verification email. Please check the Gmail mailer configuration and try again.'
    });
  }

  db.users.push(newUser);
  try {
    writeDB(db);
  } catch (error) {
    return res.status(500).json({ error: 'Could not create your account. Please try again.' });
  }
  return res.json({ success: true, email: newUser.email });
});

// Register Endpoint (Web Admin compatibility alias)
app.post('/api/auth/register', async (req, res) => {
  const { firstName, lastName, email, password, phoneNumber, contactNumber, role } = req.body;
  if (!firstName || !lastName || !email || !password) {
    return res.status(400).json({ message: 'All fields are required.', error: 'All fields are required.' });
  }

  const cleanEmail = email.trim().toLowerCase();
  const db = readDB();
  const existing = db.users.find(u => u.email.toLowerCase() === cleanEmail);

  if (existing) {
    if (existing.isVerified) {
      return res.status(400).json({ message: 'An account with this email already exists. Try logging in.', error: 'An account with this email already exists. Try logging in.' });
    }
    // Update unverified user with new password and code
    const code = generateCode();
    existing.passwordHash = sha256(password);
    existing.firstName = firstName.trim();
    existing.lastName = lastName.trim();
    existing.contactNumber = (phoneNumber || contactNumber || existing.contactNumber || 'N/A').trim();
    existing.emailVerificationCodeHash = sha256(code);
    existing.emailVerificationExpiresAt = Date.now() + VERIFICATION_CODE_TTL_MS;

    try {
      await sendVerificationEmail(existing.email, code);
    } catch (error) {
      console.error('Failed to send registration verification email:', error.message);
      return res.status(503).json({ error: 'Could not send verification email. Please try again.' });
    }

    try {
      writeDB(db);
    } catch (error) {
      return res.status(500).json({ error: 'Could not update your account. Please try again.' });
    }
    return res.json({ success: true, message: 'Verification code sent to your email.', email: existing.email });
  }

  const code = generateCode();
  const newUser = {
    id: String(Date.now()),
    firstName: firstName.trim(),
    lastName: lastName.trim(),
    email: cleanEmail,
    passwordHash: sha256(password),
    role: role || 'barangay_official',
    failedAttempts: 0,
    isVerified: false,
    mfaEnabled: false,
    mfaSecret: '',
    contactNumber: (phoneNumber || contactNumber || 'N/A').trim(),
    emailVerificationCodeHash: sha256(code),
    emailVerificationExpiresAt: Date.now() + VERIFICATION_CODE_TTL_MS
  };

  try {
    await sendVerificationEmail(newUser.email, code);
  } catch (error) {
    console.error('Failed to send signup verification email:', error.message);
    return res.status(503).json({
      error: 'We could not send a verification email. Please check the Gmail mailer configuration and try again.'
    });
  }

  db.users.push(newUser);
  try {
    writeDB(db);
  } catch (error) {
    return res.status(500).json({ error: 'Could not create your account. Please try again.' });
  }
  return res.json({ success: true, message: 'User registered successfully. Verification code sent.', email: newUser.email });
});

// Verify Email Code Endpoint
app.post('/api/auth/verify-email', (req, res) => {
  const { email, code } = req.body;
  if (!email || !code) {
    return res.status(400).json({ error: 'Email and verification code are required.' });
  }

  const db = readDB();
  const user = db.users.find(u => u.email.toLowerCase() === email.trim().toLowerCase());

  if (!user) {
    return res.status(404).json({ error: 'User account not found.' });
  }

  const isExpired = !user.emailVerificationExpiresAt || user.emailVerificationExpiresAt <= Date.now();
  const matchesCode = user.emailVerificationCodeHash
    ? user.emailVerificationCodeHash === sha256(code.trim())
    : user.emailVerificationCode === code.trim();
  if (isExpired || !matchesCode) {
    if (isExpired) {
      return res.status(400).json({ error: 'That verification code has expired. Request a new code and try again.' });
    }
    return res.status(400).json({ error: 'Incorrect verification code. Please try again.' });
  }

  user.isVerified = true;
  delete user.emailVerificationCode;
  delete user.emailVerificationCodeHash;
  delete user.emailVerificationExpiresAt;
  writeDB(db);

  // If the email is verified, and the user is either a citizen OR an already-approved rescuer, log them in automatically
  if (user.role === 'citizen' || (user.role === 'rescuer' && user.isRescuerVerified === true)) {
    const token = `token-${user.id}-${Math.random().toString(36).substring(2)}`;
    const publicUser = {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      name: `${user.firstName} ${user.lastName}`.trim(),
      email: user.email,
      role: user.role,
      mfaEnabled: user.mfaEnabled,
      contactNumber: user.contactNumber,
      idType: user.idType,
      idNumber: user.idNumber,
      isRescuerVerified: user.isRescuerVerified
    };

    const session = {
      id: `session-${user.id}-${Date.now()}`,
      loginTime: Date.now(),
      deviceInfo: 'App Connected (Live)',
      ipAddress: req.ip || '127.0.0.1',
      token: token,
      expiresAt: Date.now() + 60 * 60 * 1000 // 1 hour
    };

    return res.json({
      success: true,
      isVerified: true,
      isRescuerVerified: user.isRescuerVerified,
      user: publicUser,
      session: session
    });
  }

  return res.json({
    success: true,
    isVerified: true,
    isRescuerVerified: user.isRescuerVerified
  });
});

// Resend Verification Code Endpoint
app.post('/api/auth/resend-code', async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Email is required.' });
  }

  const db = readDB();
  const user = db.users.find(u => u.email.toLowerCase() === email.trim().toLowerCase());

  if (!user) {
    return res.status(404).json({ error: 'User account not found.' });
  }

  if (user.isVerified) {
    return res.status(400).json({ error: 'This email address is already verified.' });
  }

  const code = generateCode();
  user.emailVerificationCodeHash = sha256(code);
  user.emailVerificationExpiresAt = Date.now() + VERIFICATION_CODE_TTL_MS;
  delete user.emailVerificationCode;

  try {
    await sendVerificationEmail(user.email, code);
  } catch (error) {
    console.error('Failed to resend verification email:', error.message);
    return res.status(503).json({
      error: 'We could not send a verification email. Please try again later.'
    });
  }
  try {
    writeDB(db);
  } catch (error) {
    return res.status(500).json({ error: 'Could not update your verification request. Please try again.' });
  }
  return res.json({ success: true });
});

// Login Endpoint
app.post('/api/auth/login', async (req, res) => {
  const email = (req.body.email || req.body.username || '').trim().toLowerCase();
  const { password, role } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.', message: 'Email and password are required.' });
  }

  const db = readDB();
  const user = db.users.find(u => u.email.toLowerCase() === email);

  if (!user) {
    return res.status(400).json({ error: 'Incorrect email or password. Please try again.', message: 'Incorrect email or password. Please try again.' });
  }

  if (role && user.role !== role) {
    return res.status(400).json({ error: `This account is registered as a ${user.role}, not a ${role}.`, message: `This account is registered as a ${user.role}, not a ${role}.` });
  }

  if (user.role === 'rescuer' && user.isRescuerVerified === false) {
    return res.status(403).json({ error: 'Your rescuer account is pending verification by the admin dashboard.', message: 'Your rescuer account is pending verification by the admin dashboard.' });
  }

  const passwordHash = sha256(password);
  if (user.passwordHash !== passwordHash) {
    user.failedAttempts = (user.failedAttempts || 0) + 1;
    writeDB(db);
    return res.status(400).json({ error: 'Incorrect email or password. Please try again.', message: 'Incorrect email or password. Please try again.' });
  }

  user.failedAttempts = 0;

  if (!user.isVerified) {
    const code = generateCode();
    user.emailVerificationCodeHash = sha256(code);
    user.emailVerificationExpiresAt = Date.now() + VERIFICATION_CODE_TTL_MS;
    delete user.emailVerificationCode;
    try {
      await sendVerificationEmail(user.email, code);
    } catch (error) {
      console.error('Failed to send login verification email:', error.message);
      return res.status(503).json({
        error: 'We could not send a verification email. Please try again later.',
        message: 'We could not send a verification email. Please try again later.'
      });
    }
    try {
      writeDB(db);
    } catch (error) {
      return res.status(500).json({ error: 'Could not update your account. Please try again.' });
    }
    return res.json({ requiresVerification: true, email: user.email, unverified: true, message: 'Please verify your email.' });
  }

  writeDB(db);

  const token = `token-${user.id}-${crypto.randomBytes ? crypto.randomBytes(16).toString('hex') : Math.random().toString(36).substring(2)}`;
  const publicUser = {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    name: `${user.firstName} ${user.lastName}`.trim(),
    email: user.email,
    role: user.role,
    mfaEnabled: user.mfaEnabled,
    contactNumber: user.contactNumber,
    idType: user.idType,
    idNumber: user.idNumber,
    isRescuerVerified: user.isRescuerVerified
  };

  const session = {
    id: `session-${user.id}-${Date.now()}`,
    loginTime: Date.now(),
    deviceInfo: 'App Connected (Live)',
    ipAddress: req.ip || '127.0.0.1',
    token: token,
    expiresAt: Date.now() + 60 * 60 * 1000
  };

  return res.json({
    success: true,
    user: publicUser,
    session: session,
    token: token,
    message: 'Signed in successfully.'
  });
});

// Request Password Reset Endpoint
const handlePasswordReset = async (req, res) => {
  const email = (req.body.email || req.body.username || '').trim().toLowerCase();
  if (!email) {
    return res.status(400).json({ error: 'Email is required.', message: 'Email is required.' });
  }

  const db = readDB();
  const user = db.users.find(u => u.email.toLowerCase() === email);

  if (!user) {
    return res.status(404).json({ error: 'No account found for that email.', message: 'No account found for that email.' });
  }

  const code = generateCode();
  user.passwordResetCode = code;
  writeDB(db);

  try {
    await sendPasswordResetEmail(user.email, code);
  } catch (error) {
    console.error('Failed to send password reset email:', error.message);
  }

  return res.json({
    success: true,
    message: 'Password reset code sent to your email.'
  });
};

app.post('/api/auth/request-reset', handlePasswordReset);
app.post('/api/auth/forgot-password', handlePasswordReset);

// 2FA / MFA endpoint
app.post('/api/auth/verify-2fa', (req, res) => {
  const email = (req.body.email || req.body.username || '').trim().toLowerCase();
  if (!email) {
    return res.status(400).json({ error: 'Email or username is required.', message: 'Email or username is required.' });
  }

  const db = readDB();
  const user = db.users.find(u => u.email.toLowerCase() === email);

  if (!user) {
    return res.status(404).json({ error: 'User account not found.', message: 'User account not found.' });
  }

  const token = `token-${user.id}-${Math.random().toString(36).substring(2)}`;
  const publicUser = {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    name: `${user.firstName} ${user.lastName}`.trim(),
    email: user.email,
    role: user.role,
    mfaEnabled: user.mfaEnabled,
    contactNumber: user.contactNumber,
    idType: user.idType,
    idNumber: user.idNumber,
    isRescuerVerified: user.isRescuerVerified
  };

  const session = {
    id: `session-${user.id}-${Date.now()}`,
    loginTime: Date.now(),
    deviceInfo: 'App Connected (Live)',
    ipAddress: req.ip || '127.0.0.1',
    token: token,
    expiresAt: Date.now() + 60 * 60 * 1000
  };

  return res.json({
    success: true,
    token: token,
    user: publicUser,
    session: session,
    expiry: Date.now() + 60 * 60 * 1000
  });
});

// Reset Password Endpoint
app.post('/api/auth/reset-password', (req, res) => {
  const { email, code, newPassword } = req.body;
  if (!email || !code || !newPassword) {
    return res.status(400).json({ error: 'All fields are required.' });
  }

  const db = readDB();
  const user = db.users.find(u => u.email.toLowerCase() === email.trim().toLowerCase());

  if (!user || user.passwordResetCode !== code.trim()) {
    return res.status(400).json({ error: 'Invalid or expired recovery code.' });
  }

  user.passwordHash = sha256(newPassword);
  delete user.passwordResetCode;
  user.failedAttempts = 0;
  writeDB(db);

  return res.json({
    success: true,
    message: 'Password reset successfully.'
  });
});

// Submit Rescuer Verification Documents Endpoint
app.post('/api/auth/rescuer-verify', (req, res) => {
  const { email, idType, idNumber, idFrontUri, idBackUri } = req.body;

  if (!email || !idType || !idNumber) {
    return res.status(400).json({ error: 'Email, ID type, and ID number are required.' });
  }

  const db = readDB();
  const user = db.users.find(u => u.email.toLowerCase() === email.trim().toLowerCase() && u.role === 'rescuer');

  if (!user) {
    return res.status(404).json({ error: 'Rescuer account not found.' });
  }

  // Save verification documents — status stays pending (false) until admin approves
  user.idType = idType.trim();
  user.idNumber = idNumber.trim();
  user.idFrontUri = idFrontUri || '';
  user.idBackUri = idBackUri || '';
  user.isRescuerVerified = false;

  writeDB(db);

  return res.json({
    success: true,
    message: 'Verification documents submitted successfully. Awaiting admin approval.'
  });
});

// ── Admin Panel API Routes ───────────────────────────────────────────────────

// Get all registered rescuers
// ── Admin Panel Auth Middleware ──────────────────────────────────────────────
function requireAdminKey(req, res, next) {
  const expectedKey = process.env.ADMIN_API_KEY || '';
  if (!expectedKey) {
    return next(); // Default permissive in local dev if not explicitly set
  }
  const supplied = (req.get('X-Admin-Key') || req.query.adminKey || '').trim();
  const suppliedBuf = Buffer.from(supplied);
  const expectedBuf = Buffer.from(expectedKey);
  if (
    suppliedBuf.length !== expectedBuf.length ||
    !crypto.timingSafeEqual(suppliedBuf, expectedBuf)
  ) {
    return res.status(401).json({ error: 'Unauthorized: invalid or missing admin key.' });
  }
  next();
}

app.get('/api/admin/rescuers', requireAdminKey, (req, res) => {
  const db = readDB();
  const rescuers = db.users
    .filter(u => u.role === 'rescuer')
    .map(u => ({
      id: u.id,
      firstName: u.firstName,
      lastName: u.lastName,
      email: u.email,
      contactNumber: u.contactNumber,
      idType: u.idType,
      idNumber: u.idNumber,
      isRescuerVerified: u.isRescuerVerified,
      isVerified: u.isVerified,
      idFrontUri: u.idFrontUri,
      idBackUri: u.idBackUri
    }));
  return res.json(rescuers);
});

// Approve a rescuer
app.post('/api/admin/rescuers/:id/approve', requireAdminKey, (req, res) => {
  const { id } = req.params;
  const db = readDB();
  const user = db.users.find(u => u.id === id && u.role === 'rescuer');

  if (!user) {
    return res.status(404).json({ error: 'Rescuer account not found.' });
  }

  user.isRescuerVerified = true;
  writeDB(db);

  return res.json({ success: true, message: `Rescuer ${user.firstName} approved successfully.` });
});

// Approve a rescuer by email (called by web backend to sync the two DBs)
app.post('/api/admin/rescuers/approve-by-email', (req, res) => {
  const { email } = req.body;
  if (!email || typeof email !== 'string') {
    return res.status(400).json({ error: 'email is required.' });
  }
  const db = readDB();
  const user = db.users.find(
    u => u.email.toLowerCase() === email.trim().toLowerCase() && u.role === 'rescuer'
  );
  if (!user) {
    return res.status(404).json({ error: 'Rescuer account not found in mobile DB.' });
  }
  user.isRescuerVerified = true;
  writeDB(db);
  return res.json({ success: true, message: `Rescuer ${user.firstName} approved and synced from web backend.` });
});

// Reject/Revoke a rescuer verification
app.post('/api/admin/rescuers/:id/reject', requireAdminKey, (req, res) => {
  const { id } = req.params;
  const db = readDB();
  const user = db.users.find(u => u.id === id && u.role === 'rescuer');

  if (!user) {
    return res.status(404).json({ error: 'Rescuer account not found.' });
  }

  user.isRescuerVerified = false;
  writeDB(db);

  return res.json({ success: true, message: `Rescuer ${user.firstName} status set to rejected/pending.` });
});

// Fetch general dashboard statistics
app.get('/api/admin/stats', requireAdminKey, (req, res) => {
  const db = readDB();
  const totalCitizens = db.users.filter(u => u.role === 'citizen').length;
  const rescuers = db.users.filter(u => u.role === 'rescuer');
  const totalRescuers = rescuers.length;
  const pendingRescuers = rescuers.filter(u => u.isRescuerVerified === false).length;
  const approvedRescuers = rescuers.filter(u => u.isRescuerVerified === true).length;

  return res.json({
    totalCitizens,
    totalRescuers,
    pendingRescuers,
    approvedRescuers
  });
});

// Start the server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running smoothly at http://0.0.0.0:${PORT}`);
});