// src/context/AuthContext.tsx
import React, { createContext, useContext, useState, ReactNode } from 'react';
import { Platform } from 'react-native';
import { API_BASE_URL } from '../config';

// ── Pure JS SHA-256 Implementation ──────────────────────────────────────────
function sha256(ascii: string): string {
  function rightRotate(value: number, amount: number) {
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
  let words: number[] = [];
  for (let i = 0; i < asciiLength; i++) {
    words[i >> 2] |= ascii.charCodeAt(i) << (24 - (i % 4) * 8);
  }
  words[asciiLength >> 2] |= 0x80 << (24 - (asciiLength % 4) * 8);
  let wordCount = ((asciiLength + 8) >> 6) * 16 + 16;
  while (words.length < wordCount) words.push(0);
  words[wordCount - 1] = asciiBitLength;

  for (let i = 0; i < wordCount; i += 16) {
    let w: number[] = [];
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

// ── Password policy (ported from teammate's Auth.tsx) ──────────────────────
export type PasswordRequirements = {
  length: boolean;
  uppercase: boolean;
  lowercase: boolean;
  number: boolean;
  special: boolean;
};

export type PasswordPolicyResult = {
  requirements: PasswordRequirements;
  score: number; // 0 to 5
  label: 'Weak' | 'Fair' | 'Good' | 'Strong' | 'Excellent';
};

export function checkPasswordPolicy(pass: string): PasswordPolicyResult {
  const requirements: PasswordRequirements = {
    length: pass.length >= 8,
    uppercase: /[A-Z]/.test(pass),
    lowercase: /[a-z]/.test(pass),
    number: /[0-9]/.test(pass),
    special: /[^A-Za-z0-9]/.test(pass),
  };
  const score = Object.values(requirements).filter(Boolean).length;
  const labels: PasswordPolicyResult['label'][] = ['Weak', 'Weak', 'Fair', 'Good', 'Strong', 'Excellent'];
  return { requirements, score, label: labels[score] };
}

export const MIN_PASSWORD_SCORE = 4;

// ── Types ────────────────────────────────────────────────────────────────
type Role = 'citizen' | 'rescuer';

type UserRecord = {
  id: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  email: string;
  passwordHash: string;
  role: Role;
  failedAttempts: number;
  lockoutUntil?: number;
  isVerified: boolean;
  passwordResetCode?: string;
  mfaEnabled: boolean;
  mfaSecret: string;
  contactNumber: string;
  idType?: string;
  idNumber?: string;
  isRescuerVerified?: boolean;
};

type PublicUser = {
  id: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  name: string;
  email: string;
  role: Role;
  mfaEnabled: boolean;
  mfaSecret: string;
  contactNumber: string;
  idType?: string;
  idNumber?: string;
  isRescuerVerified?: boolean;
};

export type SessionDetails = {
  id: string;
  loginTime: number;
  deviceInfo: string;
  ipAddress: string;
  token: string;
  expiresAt: number;
};

// Which sub-screen the login flow is currently on, driven from context so
// LoginScreen can just render off of it.
export type AuthStep = 'login' | 'verify_email' | 'mfa';

type AuthContextType = {
  user: PublicUser | null;
  session: SessionDetails | null;
  loading: boolean;
  error: string;
  clearError: () => void;

  authStep: AuthStep;
  pendingEmail: string;
  // Used for the recovery-code demo; email verification codes are never returned here.
  devCode: string | null;

  login: (email: string, password: string, role: string) => Promise<void>;
  signUp: (firstName: string, lastName: string, email: string, password: string, role: string, contactNumber: string, idType?: string, idNumber?: string, idFrontUri?: string, idBackUri?: string, middleName?: string) => Promise<boolean>;
  logout: () => void;
  updateUser: (updates: Partial<Pick<UserRecord, 'mfaEnabled' | 'mfaSecret'>>) => void;

  verifyEmailCode: (code: string) => Promise<boolean>;
  resendVerificationCode: () => Promise<boolean>;

  verifyMfaCode: (code: string) => Promise<boolean>;
  cancelPendingAuth: () => void;

  requestPasswordReset: (email: string) => Promise<boolean>;
  resetPassword: (email: string, code: string, newPassword: string) => Promise<boolean>;

  getLockoutSecondsRemaining: (email: string) => number;
};

const AuthContext = createContext<AuthContextType | null>(null);

const LOCKOUT_DURATION_MS = 30_000;
const MAX_FAILED_ATTEMPTS = 3;

// Demo accounts exist only in dev builds; release builds start with no offline users.
let SESSION_USERS: UserRecord[] = !__DEV__ ? [] : [
  {
    id: '1', firstName: 'Test', lastName: 'Citizen', email: 'citizen@test.com',
    passwordHash: sha256('test1234'), role: 'citizen',
    failedAttempts: 0, isVerified: true, mfaEnabled: false, mfaSecret: '',
    contactNumber: '+639123456789',
  },
  {
    id: '2', firstName: 'Test', lastName: 'Rescuer', email: 'rescuer@test.com',
    passwordHash: sha256('test1234'), role: 'rescuer',
    failedAttempts: 0, isVerified: true, mfaEnabled: false, mfaSecret: '',
    contactNumber: '+639987654321',
    idType: 'Barangay ID',
    idNumber: 'BRGY-R01',
    isRescuerVerified: true,
  },
];

function findUserByEmail(email: string): UserRecord | undefined {
  const clean = email.trim().toLowerCase();
  return SESSION_USERS.find((u) => u.email.toLowerCase() === clean);
}

function clearLockoutIfNeeded(user: UserRecord) {
  if (user.lockoutUntil && user.lockoutUntil <= Date.now()) {
    user.lockoutUntil = undefined;
    user.failedAttempts = 0;
  }
}

function toPublicUser(u: UserRecord): PublicUser {
  const nameParts = [u.firstName, u.middleName, u.lastName].filter(Boolean);
  return {
    id: u.id,
    firstName: u.firstName,
    middleName: u.middleName,
    lastName: u.lastName,
    name: nameParts.join(' ').trim(),
    email: u.email,
    role: u.role,
    mfaEnabled: u.mfaEnabled,
    mfaSecret: u.mfaSecret,
    contactNumber: u.contactNumber,
    idType: u.idType,
    idNumber: u.idNumber,
    isRescuerVerified: u.isRescuerVerified,
  };
}

function createSession(user: UserRecord): SessionDetails {
  return {
    id: `session-${user.id}-${Date.now()}`,
    loginTime: Date.now(),
    deviceInfo: `${Platform.OS === 'ios' ? 'iOS' : 'Android'} (offline)`,
    ipAddress: '127.0.0.1',
    token: `offline-${Math.random().toString(36).slice(2)}`,
    expiresAt: Date.now() + 60 * 60 * 1000, // 1 hour
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [session, setSession] = useState<SessionDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [authStep, setAuthStep] = useState<AuthStep>('login');
  const [pendingEmail, setPendingEmail] = useState('');
  const [devCode, setDevCode] = useState<string | null>(null);

  function clearError() {
    setError('');
  }

  function cancelPendingAuth() {
    setAuthStep('login');
    setPendingEmail('');
    setDevCode(null);
    setError('');
  }

  async function login(email: string, password: string, role: string): Promise<void> {
    setLoading(true);
    setError('');
    try {
      const response = await fetchWithTimeout(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, role })
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || 'Login failed.');
        return;
      }

      const data = await response.json();
      if (data.requiresVerification) {
        setPendingEmail(data.email);
        setDevCode(data.devCode);
        setAuthStep('verify_email');
        return;
      }

      if (data.user?.role === 'rescuer' && data.user?.isRescuerVerified === false) {
        setError('Your account is pending admin verification before you can log in.');
        return;
      }

      setUser(data.user);
      setSession(data.session);
    } catch (e) {
      const found = findUserByEmail(email);
      if (found && found.passwordHash === sha256(password) && found.role === role) {
        if (found.role === 'rescuer' && found.isRescuerVerified === false) {
          setError('Your account is pending admin verification before you can log in.');
          return;
        }
        setUser(toPublicUser(found));
        setSession(createSession(found));
        return;
      }
      setError(
        e instanceof Error && e.name === 'AbortError'
          ? 'Login request timed out. Check your network and try again.'
          : 'Connection error. Check that the backend is running and reachable.'
      );
    } finally {
      setLoading(false);
    }
  }

  async function verifyEmailCode(code: string): Promise<boolean> {
    setLoading(true);
    setError('');
    try {
      const response = await fetchWithTimeout(`${API_BASE_URL}/api/auth/verify-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: pendingEmail, code })
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || 'Verification failed. Please try again.');
        return false;
      }

      const data = await response.json();
      setDevCode(null);

      if (data.isRescuerVerified === false) {
        setError('Email verified. Your account is pending admin verification before you can log in.');
        setAuthStep('login');
        setPendingEmail('');
        return true;
      }

      if (data.user && data.session) {
        setUser(data.user);
        setSession(data.session);
      }
      setAuthStep('login');
      setPendingEmail('');
      return true;
    } catch (e) {
      setError('Connection error. Is the backend running?');
      return false;
    } finally {
      setLoading(false);
    }
  }

  async function resendVerificationCode(): Promise<boolean> {
    if (!pendingEmail) return false;
    setLoading(true);
    setError('');
    try {
      const response = await fetchWithTimeout(`${API_BASE_URL}/api/auth/resend-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: pendingEmail })
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || 'Could not resend the verification email. Please try again.');
        return false;
      }
      return true;
    } catch {
      setError('Connection error. Could not resend the verification email.');
      return false;
    } finally {
      setLoading(false);
    }
  }

  async function verifyMfaCode(code: string): Promise<boolean> {
    setLoading(true);
    setError('');
    try {
      if (!code.trim() || code.trim().length !== 6) {
        setError('Please enter the 6-digit code from your authenticator.');
        return false;
      }
      // Fallback local support for MFA demo step
      const found = SESSION_USERS.find(u => u.email.toLowerCase() === pendingEmail.toLowerCase());
      if (found) {
        setUser(toPublicUser(found));
        setSession(createSession(found));
      }
      setAuthStep('login');
      setPendingEmail('');
      setDevCode(null);
      return true;
    } finally {
      setLoading(false);
    }
  }

  async function signUp(
    firstName: string,
    lastName: string,
    email: string,
    password: string,
    role: string,
    contactNumber: string,
    idType?: string,
    idNumber?: string,
    idFrontUri?: string,
    idBackUri?: string,
    middleName?: string
  ): Promise<boolean> {
    setLoading(true);
    setError('');
    try {
      const policy = checkPasswordPolicy(password);
      if (policy.score < MIN_PASSWORD_SCORE) {
        setError('Password is too weak. Meet at least 4 of the 5 requirements.');
        return false;
      }

      const response = await fetchWithTimeout(`${API_BASE_URL}/api/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName,
          middleName,
          lastName,
          email,
          password,
          role,
          contactNumber,
          idType,
          idNumber,
          idFrontUri,
          idBackUri
        })
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || 'Registration failed.');
        return false;
      }

      const data = await response.json();
      setDevCode(null);
      setPendingEmail(data.email);
      setAuthStep('verify_email');
      return true;
    } catch {
      setError('Connection error. Is the backend running?');
      return false;
    } finally {
      setLoading(false);
    }
  }

  async function requestPasswordReset(email: string): Promise<boolean> {
    setLoading(true);
    setError('');
    try {
      const response = await fetchWithTimeout(`${API_BASE_URL}/api/auth/request-reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || 'No account found for that email.');
        return false;
      }

      const data = await response.json();
      setDevCode(data.devCode);
      return true;
    } catch (e) {
      setError('Connection error. Is the backend running?');
      return false;
    } finally {
      setLoading(false);
    }
  }

  async function resetPassword(email: string, code: string, newPassword: string): Promise<boolean> {
    setLoading(true);
    setError('');
    try {
      const policy = checkPasswordPolicy(newPassword);
      if (policy.score < MIN_PASSWORD_SCORE) {
        setError('New password is too weak. Meet at least 4 of the 5 requirements.');
        return false;
      }

      const response = await fetchWithTimeout(`${API_BASE_URL}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code, newPassword })
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || 'Invalid or expired recovery code.');
        return false;
      }

      setDevCode(null);
      return true;
    } catch (e) {
      setError('Connection error. Is the backend running?');
      return false;
    } finally {
      setLoading(false);
    }
  }

  function getLockoutSecondsRemaining(email: string): number {
    const found = findUserByEmail(email);
    if (!found) return 0;
    clearLockoutIfNeeded(found);
    if (found.lockoutUntil && found.lockoutUntil > Date.now()) {
      return Math.ceil((found.lockoutUntil - Date.now()) / 1000);
    }
    return 0;
  }

  function logout() {
    setUser(null);
    setSession(null);
    setError('');
    cancelPendingAuth();
  }

  function updateUser(updates: Partial<Pick<UserRecord, 'mfaEnabled' | 'mfaSecret'>>) {
    if (!user) return;
    const found = SESSION_USERS.find((u) => u.id === user.id);
    if (!found) return;
    Object.assign(found, updates);
    setUser(toPublicUser(found));
  }

  return (
    <AuthContext.Provider
      value={{
        user, session, loading, error, clearError,
        authStep, pendingEmail, devCode,
        login, signUp, logout, updateUser,
        verifyEmailCode, resendVerificationCode,
        verifyMfaCode, cancelPendingAuth,
        requestPasswordReset, resetPassword,
        getLockoutSecondsRemaining,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const FETCH_TIMEOUT_MS = 30000;

function fetchWithTimeout(url: string, options?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  return fetch(url, { ...options, signal: controller.signal }).finally(() =>
    clearTimeout(timer)
  );
}
