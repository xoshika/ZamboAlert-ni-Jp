import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import crypto from 'crypto';
import path from 'path';
import { db, User, Session } from './db';
import { sendVerificationEmail } from './email';

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

// Helper to generate verification code
const generateCode = (): string => Math.floor(100000 + Math.random() * 900000).toString();

// Helper to clear lockout if time has passed
const clearLockoutIfNeeded = (user: User) => {
  if (user.lockoutUntil && user.lockoutUntil <= Date.now()) {
    db.updateUser(user.username, {
      lockoutUntil: undefined,
      failedAttempts: 0
    });
    return true;
  }
  return false;
};

// ── Auth Endpoints ───────────────────────────────────────────────────────────

// Check Lockout Status
app.get('/api/auth/lockout-status/:identifier', (req: Request, res: Response) => {
  const { identifier } = req.params;
  const user = db.findUser(identifier);
  if (!user) {
    return res.json({ locked: false, timeLeft: 0 });
  }

  clearLockoutIfNeeded(user);
  const updatedUser = db.findUser(identifier)!;

  if (updatedUser.lockoutUntil && updatedUser.lockoutUntil > Date.now()) {
    const timeLeft = Math.ceil((updatedUser.lockoutUntil - Date.now()) / 1000);
    return res.json({ locked: true, timeLeft, username: updatedUser.username });
  }

  return res.json({ locked: false, timeLeft: 0 });
});

// Login
app.post('/api/auth/login', (req: Request, res: Response) => {
  const { identifier, passwordHash, deviceInfo } = req.body;

  if (!identifier || !passwordHash) {
    return res.status(400).json({ error: 'Missing identifier or password' });
  }

  const user = db.findUser(identifier);
  if (!user) {
    return res.status(401).json({ error: 'Authentication failed. No account found.' });
  }

  clearLockoutIfNeeded(user);
  const updatedUser = db.findUser(identifier)!;

  // Enforce lockout check
  if (updatedUser.lockoutUntil && updatedUser.lockoutUntil > Date.now()) {
    const timeLeft = Math.ceil((updatedUser.lockoutUntil - Date.now()) / 1000);
    return res.status(423).json({
      error: 'Account locked',
      message: `Too many failed attempts. Try again in ${timeLeft} seconds.`,
      timeLeft
    });
  }

  // Validate Password Hash
  if (updatedUser.passwordHash !== passwordHash) {
    const failedAttempts = (updatedUser.failedAttempts || 0) + 1;
    let lockoutUntil = undefined;
    const MAX_ATTEMPTS = 3;
    const LOCKOUT_DURATION = 30000; // 30 seconds

    if (failedAttempts >= MAX_ATTEMPTS) {
      lockoutUntil = Date.now() + LOCKOUT_DURATION;
      db.updateUser(updatedUser.username, { failedAttempts, lockoutUntil });
      return res.status(423).json({
        error: 'Account locked',
        message: `Too many failed attempts. Try again in 30 seconds.`,
        timeLeft: 30
      });
    } else {
      db.updateUser(updatedUser.username, { failedAttempts });
      return res.status(401).json({
        error: 'Authentication failed',
        message: `${MAX_ATTEMPTS - failedAttempts} attempts remaining before lockout.`,
        remainingAttempts: MAX_ATTEMPTS - failedAttempts
      });
    }
  }

  // Successful verification of credentials: reset attempts
  db.updateUser(updatedUser.username, { failedAttempts: 0, lockoutUntil: undefined });

  // Check verification
  if (!updatedUser.isVerified) {
    return res.status(202).json({
      status: 'VERIFICATION_REQUIRED',
      email: updatedUser.email,
      message: 'Please verify your email to log in.'
    });
  }

  // Check MFA
  if (updatedUser.mfaEnabled) {
    return res.status(202).json({
      status: 'MFA_REQUIRED',
      username: updatedUser.username,
      message: 'MFA is required for this account.'
    });
  }

  // Issue Session Details
  const token = 'tok_' + crypto.randomBytes(24).toString('hex');
  const session: Session = {
    id: `session-${updatedUser.username}-${Date.now()}`,
    username: updatedUser.username,
    loginTime: Date.now(),
    deviceInfo: deviceInfo || 'Unknown Rescuer Node',
    ipAddress: req.ip || '127.0.0.1',
    token,
    expiresAt: Date.now() + 60 * 60 * 1000 // 1 hour session
  };

  res.json({
    status: 'SUCCESS',
    user: {
      username: updatedUser.username,
      email: updatedUser.email,
      isVerified: updatedUser.isVerified,
      mfaEnabled: updatedUser.mfaEnabled,
    },
    session
  });
});

// Register
app.post('/api/auth/register', async (req: Request, res: Response) => {
  const { username, email, passwordHash } = req.body;

  if (!username || !email || !passwordHash) {
    return res.status(400).json({ error: 'Missing registration details' });
  }

  const existingUser = db.findUser(username) || db.findUser(email);
  if (existingUser) {
    return res.status(409).json({ error: 'Account already exists' });
  }

  const verificationCode = generateCode();

  const newUser: User = {
    username,
    email,
    passwordHash,
    isVerified: false,
    emailVerificationCode: verificationCode,
    mfaEnabled: false,
    mfaSecret: 'ZB-' + generateCode().slice(0, 4),
    failedAttempts: 0
  };

  db.createUser(newUser);

  try {
    await sendVerificationEmail(email, verificationCode, 'verification');
    res.status(201).json({
      message: 'Registration successful. A verification code has been sent to your email.',
      email: newUser.email,
      delivery: 'email',
      debugCode: verificationCode
    });
  } catch (error) {
    console.error('Failed to send verification email', error);
    res.status(201).json({
      message: 'Registration successful. Verification email could not be delivered automatically.',
      email: newUser.email,
      delivery: 'pending',
      debugCode: verificationCode
    });
  }
});

// Verify Email
app.post('/api/auth/verify-email', (req: Request, res: Response) => {
  const { email, code } = req.body;

  if (!email || !code) {
    return res.status(400).json({ error: 'Email and verification code are required' });
  }

  const user = db.findUser(email);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  if (user.emailVerificationCode !== code) {
    return res.status(400).json({ error: 'Invalid verification code' });
  }

  db.updateUser(user.username, {
    isVerified: true,
    emailVerificationCode: undefined
  });

  res.json({ message: 'Email verified successfully' });
});

// Resend Code
app.post('/api/auth/resend-code', async (req: Request, res: Response) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  const user = db.findUser(email);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  const verificationCode = generateCode();
  db.updateUser(user.username, { emailVerificationCode: verificationCode });

  try {
    await sendVerificationEmail(email, verificationCode, 'verification');
    res.json({
      message: 'Verification code resent.',
      delivery: 'email'
    });
  } catch (error) {
    console.error('Failed to resend verification email', error);
    res.status(500).json({
      error: 'Could not resend verification email. Please contact support.'
    });
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

// Request Password Reset
app.post('/api/auth/forgot-password', async (req: Request, res: Response) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  const user = db.findUser(email);
  if (!user) {
    return res.status(404).json({ error: 'No account found for that email' });
  }

  const resetCode = generateCode();
  db.updateUser(user.username, { emailVerificationCode: resetCode });

  try {
    await sendVerificationEmail(email, resetCode, 'reset');
    res.json({
      message: 'Password reset code sent.',
      delivery: 'email'
    });
  } catch (error) {
    console.error('Failed to send reset email', error);
    res.status(500).json({
      error: 'Could not send password reset email. Please contact support.'
    });
  }
});

// Reset Password
app.post('/api/auth/reset-password', (req: Request, res: Response) => {
  const { email, code, newPasswordHash } = req.body;
  if (!email || !code || !newPasswordHash) {
    return res.status(400).json({ error: 'Missing required reset fields' });
  }

  const user = db.findUser(email);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  if (user.emailVerificationCode !== code) {
    return res.status(400).json({ error: 'Invalid verification code' });
  }

  db.updateUser(user.username, {
    passwordHash: newPasswordHash,
    emailVerificationCode: undefined,
    failedAttempts: 0,
    lockoutUntil: undefined
  });

  res.json({ message: 'Password reset successfully' });
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
