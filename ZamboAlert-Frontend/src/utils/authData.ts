// ── Types ───────────────────────────────────────────────────────────────────
export interface UserRecord {
  username: string;
  email: string;
  passwordHash: string;
  isVerified: boolean;
  emailVerificationCode?: string;
  mfaEnabled: boolean;
  mfaSecret: string;
  failedAttempts: number;
  lockoutUntil?: number;
}

export interface SessionDetails {
  id: string;
  loginTime: number;
  deviceInfo: string;
  ipAddress: string;
  token: string;
  expiresAt: number;
}

// ── Mock Database ───────────────────────────────────────────────────────────
// We use a global array to preserve mock users throughout the bundle runtime.
export const MOCK_USERS_DATABASE: UserRecord[] = [
  {
    username: "rescuer1",
    email: "rescuer1@zamboalert.gov",
    // SHA-256 of "SecurePass123!"
    passwordHash: "8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918",
    isVerified: true,
    mfaEnabled: false,
    mfaSecret: "ZB-928A",
    failedAttempts: 0,
  }
];

// Helper database functions
export function findUser(identifier: string): UserRecord | undefined {
  const cleanId = identifier.trim().toLowerCase();
  return MOCK_USERS_DATABASE.find(
    (u) => u.username.toLowerCase() === cleanId || u.email.toLowerCase() === cleanId
  );
}

export function saveUser(user: UserRecord) {
  // Deprecated: updates are managed via backend APIs now.
  // We keep it as a no-op to maintain client compatibility.
}