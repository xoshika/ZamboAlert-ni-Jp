import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import crypto from 'crypto';
import path from 'path';
import { db, User, Session } from './db';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Mock Data for telemetry & victims (kept from original implementation)
let victims = [
  { id: 'V1', name: 'John Doe', lat: 6.9214, lng: 122.0790, floor: 2, bearing: 45, distance: 12.5, status: 'CRITICAL', signal: -75 },
  { id: 'V2', name: 'Jane Smith', lat: 6.9220, lng: 122.0805, floor: 1, bearing: 180, distance: 24.1, status: 'STABLE', signal: -82 },
];

let meshNodes = [
  { id: 'Node-01', name: 'Mesh Pod Alpha', status: 'ONLINE', signal: -68, battery: 92, hops: 1 },
  { id: 'Node-02', name: 'Mesh Pod Beta', status: 'SYNCING', signal: -80, battery: 74, hops: 2 },
  { id: 'Node-03', name: 'Mesh Pod Gamma', status: 'OFFLINE', signal: 0, battery: 12, hops: 0 }
];

let telemetryLogs = [
  { timestamp: new Date().toISOString(), source: 'MESH', message: 'Node-01 joined the mesh network' },
  { timestamp: new Date().toISOString(), source: 'BLE', message: 'Victim V1 beacon signal detected' },
  { timestamp: new Date().toISOString(), source: 'VICTIM', message: 'Victim V2 location updated' }
];

import { initializeApp, cert, App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import serviceAccount from '../serviceAccountKey.json';

const firebaseApp: App = initializeApp({
  credential: cert(serviceAccount as any)
});

const firebaseAuth = getAuth(firebaseApp);

// ── Auth Endpoints ───────────────────────────────────────────────────────────

// Verify Firebase Token and Login
app.post('/api/auth/login', async (req: Request, res: Response) => {
  const { idToken, deviceInfo } = req.body;

  if (!idToken) {
    return res.status(400).json({ error: 'Missing idToken' });
  }

  try {
    const decodedToken = await firebaseAuth.verifyIdToken(idToken);
    const { email, uid, email_verified } = decodedToken;

    if (!email) {
      return res.status(400).json({ error: 'Token does not contain an email' });
    }

    // Check if user exists in local DB
    let user = db.findUser(email);
    if (!user) {
      // Create user if they don't exist
      user = {
        username: email.split('@')[0] + '_' + uid.substring(0, 4),
        email: email,
        passwordHash: '', // Not used anymore
        isVerified: email_verified || false,
        mfaEnabled: false,
        mfaSecret: '',
        failedAttempts: 0
      };
      db.createUser(user);
    } else {
      // Update verification status
      db.updateUser(user.username, { isVerified: email_verified || false });
      user.isVerified = email_verified || false;
    }

    // Check verification
    if (!user.isVerified) {
      return res.status(202).json({
        status: 'VERIFICATION_REQUIRED',
        email: user.email,
        message: 'Please verify your email in Firebase to log in.'
      });
    }

    // Check MFA
    if (user.mfaEnabled) {
      return res.status(202).json({
        status: 'MFA_REQUIRED',
        username: user.username,
        message: 'MFA is required for this account.'
      });
    }

    // Issue Session Details
    const token = 'tok_' + crypto.randomBytes(24).toString('hex');
    const session: Session = {
      id: `session-${user.username}-${Date.now()}`,
      username: user.username,
      loginTime: Date.now(),
      deviceInfo: deviceInfo || 'Unknown Rescuer Node',
      ipAddress: req.ip || '127.0.0.1',
      token,
      expiresAt: Date.now() + 60 * 60 * 1000 // 1 hour session
    };

    res.json({
      status: 'SUCCESS',
      user: {
        username: user.username,
        email: user.email,
        isVerified: user.isVerified,
        mfaEnabled: user.mfaEnabled,
      },
      session
    });
  } catch (error) {
    console.error('Firebase token verification error:', error);
    return res.status(401).json({ error: 'Invalid or expired idToken' });
  }
});

// Verify MFA
app.post('/api/auth/verify-mfa', (req: Request, res: Response) => {
  const { username, code, deviceInfo } = req.body;
  if (!username || !code) {
    return res.status(400).json({ error: 'Username and MFA code are required' });
  }

  const user = db.findUser(username);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  // In this demo implementation, any 6 digit code matching the user's secret suffix or '123456' is accepted
  const isValid = code === '123456' || code === user.mfaSecret.replace('ZB-', '');
  if (!isValid) {
    return res.status(400).json({ error: 'Invalid MFA verification token' });
  }

  const token = 'tok_' + crypto.randomBytes(24).toString('hex');
  const session: Session = {
    id: `session-${user.username}-${Date.now()}`,
    username: user.username,
    loginTime: Date.now(),
    deviceInfo: deviceInfo || 'Unknown Rescuer Node',
    ipAddress: req.ip || '127.0.0.1',
    token,
    expiresAt: Date.now() + 60 * 60 * 1000
  };

  res.json({
    status: 'SUCCESS',
    user: {
      username: user.username,
      email: user.email,
      isVerified: user.isVerified,
      mfaEnabled: user.mfaEnabled,
    },
    session
  });
});

// ── Standard Endpoints ───────────────────────────────────────────────────────

app.get('/api/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Victims Endpoint
app.get('/api/victims', (req: Request, res: Response) => {
  res.json(victims);
});

app.post('/api/victims', (req: Request, res: Response) => {
  const newVictim = req.body;
  if (!newVictim.id || !newVictim.name) {
    return res.status(400).json({ error: 'Missing victim id or name' });
  }
  victims.push(newVictim);
  
  // Add telemetry event log
  telemetryLogs.unshift({
    timestamp: new Date().toISOString(),
    source: 'VICTIM',
    message: `New victim alert created: ${newVictim.name} (${newVictim.id})`
  });

  res.status(201).json(newVictim);
});

// Mesh Nodes (Pods) Endpoint
app.get('/api/pods', (req: Request, res: Response) => {
  res.json(meshNodes);
});

app.put('/api/pods/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const updates = req.body;
  
  let nodeIndex = meshNodes.findIndex(n => n.id === id);
  if (nodeIndex === -1) {
    return res.status(404).json({ error: 'Mesh node not found' });
  }

  meshNodes[nodeIndex] = { ...meshNodes[nodeIndex], ...updates };

  telemetryLogs.unshift({
    timestamp: new Date().toISOString(),
    source: 'MESH',
    message: `Mesh node ${id} status updated to ${meshNodes[nodeIndex].status}`
  });

  res.json(meshNodes[nodeIndex]);
});

// Logs Endpoint
app.get('/api/logs', (req: Request, res: Response) => {
  res.json(telemetryLogs);
});

app.post('/api/logs', (req: Request, res: Response) => {
  const log = req.body;
  if (!log.source || !log.message) {
    return res.status(400).json({ error: 'Missing source or message' });
  }
  const newLog = {
    timestamp: new Date().toISOString(),
    source: log.source,
    message: log.message
  };
  telemetryLogs.unshift(newLog);
  res.status(201).json(newLog);
});

app.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`ZamboAlert server running on port ${PORT} on all interfaces`);
});
