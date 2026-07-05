import fs from 'fs';
import path from 'path';

export interface User {
  username: string;
  email: string;
  passwordHash: string; // Hex representation of client-side SHA-256 password hash
  isVerified: boolean;
  emailVerificationCode?: string;
  mfaEnabled: boolean;
  mfaSecret: string;
  failedAttempts: number;
  lockoutUntil?: number;
}

export interface Session {
  id: string;
  username: string;
  loginTime: number;
  deviceInfo: string;
  ipAddress: string;
  token: string;
  expiresAt: number;
}

const DB_FILE = path.join(__dirname, 'users.json');

// Default initial user matching the frontend's mock database
const DEFAULT_USERS: User[] = [
  {
    username: "rescuer1",
    email: "rescuer1@zamboalert.gov",
    passwordHash: "8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918", // SHA-256 of "SecurePass123!"
    isVerified: true,
    mfaEnabled: true,
    mfaSecret: "ZB-928A",
    failedAttempts: 0,
  }
];

class FileDatabase {
  private users: User[] = [];

  constructor() {
    this.load();
  }

  private load() {
    try {
      if (fs.existsSync(DB_FILE)) {
        const data = fs.readFileSync(DB_FILE, 'utf8');
        this.users = JSON.parse(data);
      } else {
        this.users = [...DEFAULT_USERS];
        this.save();
      }
    } catch (error) {
      console.error('Failed to load database, using memory defaults', error);
      this.users = [...DEFAULT_USERS];
    }
  }

  private save() {
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(this.users, null, 2), 'utf8');
    } catch (error) {
      console.error('Failed to save database', error);
    }
  }

  public getUsers(): User[] {
    return this.users;
  }

  public findUser(identifier: string): User | undefined {
    const cleanId = identifier.trim().toLowerCase();
    return this.users.find(
      u => u.username.toLowerCase() === cleanId || u.email.toLowerCase() === cleanId
    );
  }

  public createUser(user: User): void {
    this.users.push(user);
    this.save();
  }

  public updateUser(username: string, updates: Partial<User>): User | undefined {
    const userIndex = this.users.findIndex(u => u.username.toLowerCase() === username.toLowerCase());
    if (userIndex === -1) return undefined;

    this.users[userIndex] = { ...this.users[userIndex], ...updates };
    this.save();
    return this.users[userIndex];
  }
}

export const db = new FileDatabase();
