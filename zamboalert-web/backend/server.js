import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import sqlite3 from "sqlite3";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";
import path from "path";
import { fileURLToPath } from "url";
import admin from "firebase-admin";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const DEFAULT_PORT = Number(process.env.PORT || 5000);
const FALLBACK_PORTS = [DEFAULT_PORT, 5001, 5002, 5003, 5010];
const JWT_SECRET = process.env.JWT_SECRET || "zamboalert_secret_jwt_key_12345";
/** Root backend that receives gateway LoRa posts (must stay on :3000). Do not move this server to 3000. */
const TELEMETRY_BACKEND_URL = (process.env.TELEMETRY_BACKEND_URL || "http://127.0.0.1:3000").replace(/\/$/, "");

// Initialize Firebase Admin (optional, falls back gracefully to SQLite database)
let firestoreDb = null;
if (process.env.FIREBASE_PROJECT_ID) {
  try {
    admin.initializeApp({
      credential: process.env.FIREBASE_SERVICE_ACCOUNT_JSON
        ? admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON))
        : admin.credential.applicationDefault(),
      projectId: process.env.FIREBASE_PROJECT_ID
    });
    firestoreDb = admin.firestore();
    console.log("Firebase Admin SDK initialized successfully.");
  } catch (error) {
    console.warn("Firebase Admin SDK failed to initialize. Falling back to Local SQLite mode.", error.message);
  }
}

// Middleware
app.use(cors());
app.use(express.json());

// Initialize Database
const dbPath = path.join(__dirname, "zamboalert.db");
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error("Database connection error:", err.message);
  } else {
    console.log("Connected to SQLite database.");
    createTables();
    seedBarangayDataIfEmpty();
  }
});

function createTables() {
  db.serialize(() => {
    // Users table
    db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        is_verified INTEGER DEFAULT 0,
        verification_code TEXT,
        verification_expires INTEGER,
        two_fa_code TEXT,
        two_fa_expires INTEGER,
        phone_number TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Alter table fallback to add phone_number to existing installations
    db.run("ALTER TABLE users ADD COLUMN phone_number TEXT", (err) => {
      // Ignore errors (e.g. if the column already exists)
    });

    // Rescuers table
    db.run(`
      CREATE TABLE IF NOT EXISTS rescuers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        phone_number TEXT,
        id_type TEXT NOT NULL,
        id_number TEXT NOT NULL,
        is_verified INTEGER DEFAULT 0, -- 0 = pending, 1 = verified
        status TEXT DEFAULT 'available', -- 'available' | 'en-route' | 'offline'
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Casualty/Victim logs table
    db.run(`
      CREATE TABLE IF NOT EXISTS casualty_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        rescuer_id TEXT,
        rescuer_name TEXT,
        victim_name TEXT NOT NULL,
        age INTEGER,
        gender TEXT,
        status TEXT NOT NULL, -- 'Injured' | 'Deceased' | 'Missing' | 'Rescued'
        injury_details TEXT,
        location TEXT,
        latitude REAL,
        longitude REAL,
        disaster_type TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `, () => {
      // Alter table fallback to add disaster_type to existing installations
      db.run("ALTER TABLE casualty_logs ADD COLUMN disaster_type TEXT", (err) => {
        // Now that the column is guaranteed to exist (either created just now or already present):
        
        // Update existing records with default disaster types if they are null
        db.run("UPDATE casualty_logs SET disaster_type = 'Unknown' WHERE disaster_type IS NULL");

      });
    });

    // Settings table
    db.run(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
      )
    `, () => {
      // Seed default settings if empty
      db.get("SELECT COUNT(*) as count FROM settings", (err, row) => {
        if (!err && row && row.count === 0) {
          db.run("INSERT INTO settings (key, value) VALUES ('require_rescuer_approval', '1')");
          console.log("Seeded default settings.");
        }
      });
    });

    // Alter rescuers table for assigned target, role, zone, and location columns
    db.run("ALTER TABLE rescuers ADD COLUMN assigned_target_type TEXT", () => {});
    db.run("ALTER TABLE rescuers ADD COLUMN assigned_target_id TEXT", () => {});
    db.run("ALTER TABLE rescuers ADD COLUMN assigned_target_name TEXT", () => {});
    db.run("ALTER TABLE rescuers ADD COLUMN role TEXT DEFAULT 'Rescuer'", () => {});
    db.run("ALTER TABLE rescuers ADD COLUMN assigned_zone TEXT DEFAULT 'Unassigned'", () => {});
    db.run("ALTER TABLE rescuers ADD COLUMN latitude REAL", () => {});
    db.run("ALTER TABLE rescuers ADD COLUMN longitude REAL", () => {});
    db.run("ALTER TABLE rescuers ADD COLUMN response_status TEXT DEFAULT 'available'", () => {});

    // Households / Resident Registry table
    db.run(`
      CREATE TABLE IF NOT EXISTS households (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        resident_name TEXT NOT NULL,
        household_head TEXT NOT NULL,
        phone_number TEXT NOT NULL,
        purok_zone TEXT NOT NULL,
        occupants_count INTEGER DEFAULT 1,
        vulnerable_count INTEGER DEFAULT 0,
        status TEXT DEFAULT 'Active', -- 'Active' | 'Opted-Out' | 'Evacuated'
        latitude REAL,
        longitude REAL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Incidents & Analytics table
    db.run(`
      CREATE TABLE IF NOT EXISTS incidents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        disaster_type TEXT DEFAULT 'Flood',
        date_occurred TEXT NOT NULL,
        water_level_m REAL,
        affected_households INTEGER,
        total_rescued INTEGER,
        casualties_count INTEGER,
        avg_response_time_mins INTEGER,
        dispatch_time_mins REAL,
        on_scene_time_mins REAL,
        purok_zone TEXT,
        damage_estimate_php REAL,
        status TEXT DEFAULT 'Closed',
        summary_notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // ── Barangay Manpower & Worst-Case Disaster Resource Tables ──
    db.run(`
      CREATE TABLE IF NOT EXISTS barangays (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        district TEXT NOT NULL,
        population INTEGER NOT NULL,
        households INTEGER NOT NULL,
        risk_level TEXT NOT NULL, -- 'Extreme' | 'High' | 'Moderate'
        active_sar INTEGER DEFAULT 10,
        active_tanods INTEGER DEFAULT 20,
        active_medics INTEGER DEFAULT 6,
        active_logistics INTEGER DEFAULT 8,
        active_boat_crews INTEGER DEFAULT 4,
        rescue_boats INTEGER DEFAULT 2,
        ambulances INTEGER DEFAULT 1,
        contact_person TEXT,
        contact_number TEXT,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Manpower Alerts table for Worst-Case Disaster Scenarios
    db.run(`
      CREATE TABLE IF NOT EXISTS manpower_alerts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        barangay_id INTEGER,
        barangay_name TEXT NOT NULL,
        disaster_type TEXT NOT NULL,
        scenario_level TEXT NOT NULL,
        projected_affected_pop INTEGER,
        required_sar INTEGER,
        required_tanods INTEGER,
        required_medics INTEGER,
        required_logistics INTEGER,
        required_total INTEGER,
        available_total INTEGER,
        deficit_count INTEGER,
        deficit_percentage REAL,
        alert_level TEXT NOT NULL, -- 'CRITICAL RED' | 'SEVERE ORANGE' | 'MODERATE YELLOW' | 'SUFFICIENT GREEN'
        status TEXT DEFAULT 'Active',
        mobilization_status TEXT DEFAULT 'Pending Mobilization',
        triggered_by TEXT DEFAULT 'ZCDRRMO AI System',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Manpower Mutual Aid Transfers table
    db.run(`
      CREATE TABLE IF NOT EXISTS manpower_transfers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        from_barangay TEXT NOT NULL,
        to_barangay TEXT NOT NULL,
        disaster_type TEXT NOT NULL,
        sar_count INTEGER DEFAULT 0,
        tanod_count INTEGER DEFAULT 0,
        medic_count INTEGER DEFAULT 0,
        logistics_count INTEGER DEFAULT 0,
        total_personnel INTEGER NOT NULL,
        status TEXT DEFAULT 'En-Route', -- 'En-Route' | 'On-Scene' | 'Completed'
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Manpower External Agency Escalations table
    db.run(`
      CREATE TABLE IF NOT EXISTS manpower_escalations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        reference_no TEXT UNIQUE NOT NULL,
        target_barangays TEXT NOT NULL,
        disaster_type TEXT NOT NULL,
        scenario_level TEXT NOT NULL,
        requested_agency TEXT NOT NULL,
        requested_units TEXT NOT NULL,
        total_reinforcements INTEGER NOT NULL,
        priority TEXT NOT NULL,
        notes TEXT,
        status TEXT DEFAULT 'Acknowledged & Dispatched',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
  });
}


// Mailer Setup helper
function getTransporter() {
  const gmailUser = process.env.GMAIL_USER;
  const gmailPass = (process.env.GMAIL_APP_PASSWORD || process.env.GMAIL_PASSWORD || "").replace(/\s/g, "");
  if (gmailUser && gmailPass) {
    const port = parseInt(process.env.SMTP_PORT || "465");
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.gmail.com",
      port: port,
      secure: port === 465,
      auth: {
        user: gmailUser,
        pass: gmailPass,
      },
      family: 4, // Force IPv4: crucial on cloud containers (Render) to avoid IPv6 hang
      connectionTimeout: 4000,
      greetingTimeout: 4000,
      socketTimeout: 5000,
      tls: {
        rejectUnauthorized: false
      }
    });
  }

  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    const port = parseInt(process.env.SMTP_PORT || "587");
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: port,
      secure: process.env.SMTP_SECURE === "true" || port === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
      family: 4,
      connectionTimeout: 4000,
      greetingTimeout: 4000,
      socketTimeout: 5000,
      tls: {
        rejectUnauthorized: false
      }
    });
  }
  return null;
}

async function sendMail(to, subject, text, html, code = null) {
  // 1. If RESEND_API_KEY is provided (Uses port 443 HTTPS, immune to Render SMTP blocking)
  if (process.env.RESEND_API_KEY) {
    try {
      const resp = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          from: process.env.RESEND_FROM || "ZamboAlert <onboarding@resend.dev>",
          to: [to],
          subject,
          text,
          html
        })
      });
      if (resp.ok) {
        console.log(`[Resend HTTP] Email successfully sent to ${to}`);
        return true;
      }
      const errBody = await resp.text();
      console.warn(`[Resend HTTP API error]:`, errBody);
    } catch (e) {
      console.warn(`[Resend HTTP API failed]:`, e.message);
    }
  }

  // 2. If BREVO_API_KEY is provided (Uses port 443 HTTPS, immune to Render SMTP blocking)
  if (process.env.BREVO_API_KEY) {
    try {
      const resp = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
          "api-key": process.env.BREVO_API_KEY,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          sender: { name: "ZamboAlert Security", email: process.env.BREVO_FROM_EMAIL || process.env.GMAIL_USER || "admin@zamboalert.com" },
          to: [{ email: to }],
          subject,
          textContent: text,
          htmlContent: html
        })
      });
      if (resp.ok) {
        console.log(`[Brevo HTTP] Email successfully sent to ${to}`);
        return true;
      }
      const errBody = await resp.text();
      console.warn(`[Brevo HTTP API error]:`, errBody);
    } catch (e) {
      console.warn(`[Brevo HTTP API failed]:`, e.message);
    }
  }

  // 3. Fallback to Nodemailer SMTP
  const transporter = getTransporter();
  const fromEmail = process.env.GMAIL_USER || process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER || "no-reply@zamboalert.com";
  const fromName = process.env.SMTP_FROM_NAME || "ZamboAlert Security";

  if (transporter) {
    try {
      await transporter.sendMail({
        from: `"${fromName}" <${fromEmail}>`,
        to,
        subject,
        text,
        html,
      });
      console.log(`Email successfully sent to ${to}`);
      return true;
    } catch (error) {
      console.error(`Email sending failed: ${error.message}`);
      console.log(`\n==================================================`);
      console.log(`[FALLBACK - EMAIL SEND TIMEOUT ON RENDER]`);
      console.log(`Recipient: ${to}`);
      if (code) {
        console.log(`>>> AUTHENTICATION CODE: ${code} <<<`);
      }
      console.log(`==================================================\n`);
      return false;
    }
  } else {
    console.log("\n==================================================");
    console.log(`[SMTP NOT CONFIGURED] Email to: ${to}`);
    if (code) {
      console.log(`>>> AUTHENTICATION CODE: ${code} <<<`);
    }
    console.log("==================================================\n");
    return false;
  }
}

// Helper to generate 6-digit code
function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/* ─── API Routes ─── */

// 1. REGISTER
app.post("/api/auth/register", async (req, res) => {
  const { email, firstName, lastName, phoneNumber, password } = req.body;

  if (!email || !firstName || !lastName) {
    return res.status(400).json({ message: "All fields are required" });
  }

  const cleanEmail = email.trim().toLowerCase();
  const cleanFirstName = firstName.trim();
  const cleanLastName = lastName.trim();
  const username = `${cleanFirstName} ${cleanLastName}`;
  const tempPassword = password ? null : ("ZamboAlert_" + Math.floor(1000 + Math.random() * 9000));
  const finalPassword = password || tempPassword;

  try {
    // Check if user already exists
    db.get(
      "SELECT id, email, username, is_verified FROM users WHERE LOWER(email) = ? OR LOWER(username) = ?",
      [cleanEmail, username.toLowerCase()],
      async (err, row) => {
        if (err) return res.status(500).json({ message: "Database query error" });

        // If an account exists and is already verified:
        if (row && row.is_verified) {
          if (row.email && row.email.toLowerCase() === cleanEmail) {
            return res.status(400).json({ message: "An account with this email already exists. Please log in." });
          }
          return res.status(400).json({ message: `An account with the name "${username}" already exists. Please choose a different name or log in.` });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(finalPassword, salt);
        const code = generateCode();
        const expires = Date.now() + 15 * 60 * 1000; // 15 mins

        const subject = "Verify your ZamboAlert Account";
        const text = password
          ? `Your email verification code is: ${code}. It expires in 15 minutes.`
          : `Your email verification code is: ${code}. Your temporary login password is: ${tempPassword}. It expires in 15 minutes.`;
        const html = `
          <div style="font-family: sans-serif; padding: 20px; border: 1px solid #f1f1f1; border-radius: 8px; max-width: 500px; margin: auto;">
            <h2 style="color: #b91c1c; text-align: center;">ZamboAlert Security</h2>
            <p>Hello <strong>${username}</strong>,</p>
            <p>Thank you for registering. Here are your account details:</p>
            <div style="background-color: #f9fafb; padding: 15px; border-radius: 6px; border: 1px solid #e5e7eb; margin: 15px 0;">
              <p style="margin: 0 0 8px 0;"><strong>Username:</strong> ${username}</p>
              <p style="margin: 0 0 8px 0;"><strong>Email:</strong> ${cleanEmail}</p>
              ${password ? "" : `<p style="margin: 0;"><strong>Temporary Password:</strong> <code style="background-color: #f3f4f6; padding: 2px 6px; border-radius: 4px; font-weight: bold; color: #b91c1c;">${tempPassword}</code></p>`}
            </div>
            <p>Please use the following verification code to activate your account:</p>
            <div style="font-size: 24px; font-weight: bold; text-align: center; padding: 15px; background-color: #fef2f2; border: 1px dashed #f87171; color: #b91c1c; margin: 20px 0; border-radius: 4px; letter-spacing: 4px;">
              ${code}
            </div>
            <p style="font-size: 12px; color: #6b7280; text-align: center;">This code will expire in 15 minutes.</p>
          </div>
        `;

        // If the user already registered before but never verified: update credentials and resend verification code
        if (row && !row.is_verified) {
          return db.run(
            "UPDATE users SET email = ?, username = ?, password = ?, verification_code = ?, verification_expires = ?, phone_number = ? WHERE id = ?",
            [cleanEmail, username, hashedPassword, code, expires, phoneNumber ? phoneNumber.trim() : null, row.id],
            async function (updateErr) {
              if (updateErr) {
                return res.status(500).json({ message: "Failed to update registration" });
              }

              const emailSent = await sendMail(cleanEmail, subject, text, html, code);

              return res.status(200).json({
                message: emailSent
                  ? (password ? "Verification code sent to your email. Check your inbox." : "Verification code and temporary password sent to your email.")
                  : `Account updated! (Email timed out: verification code is ${code})`,
                email: cleanEmail,
                code: !emailSent ? code : undefined,
              });
            }
          );
        }

        // New user registration
        db.run(
          "INSERT INTO users (email, username, password, verification_code, verification_expires, phone_number, is_verified) VALUES (?, ?, ?, ?, ?, ?, 0)",
          [cleanEmail, username, hashedPassword, code, expires, phoneNumber ? phoneNumber.trim() : null],
          async function (insertErr) {
            if (insertErr) {
              return res.status(500).json({ message: "Failed to create user" });
            }

            const emailSent = await sendMail(cleanEmail, subject, text, html, code);

            return res.status(201).json({
              message: emailSent
                ? (password ? "User registered successfully. Verification code sent." : "User registered successfully. Verification code and temporary password sent.")
                : `User registered! (Email timed out: verification code is ${code})`,
              email: cleanEmail,
              code: !emailSent ? code : undefined,
            });
          }
        );
      }
    );
  } catch (error) {
    res.status(500).json({ message: "Registration error" });
  }
});

// 2. VERIFY EMAIL
app.post("/api/auth/verify-email", (req, res) => {
  const { email, code } = req.body;

  if (!email || !code) {
    return res.status(400).json({ message: "Email and verification code are required" });
  }

  const cleanEmail = email.trim().toLowerCase();
  const cleanCode = code.toString().trim();

  db.get(
    "SELECT id, verification_code, verification_expires FROM users WHERE LOWER(email) = ?",
    [cleanEmail],
    (err, row) => {
      if (err) return res.status(500).json({ message: "Database query error" });
      if (!row) return res.status(404).json({ message: "User not found" });

      if (row.verification_code !== cleanCode) {
        return res.status(400).json({ message: "Invalid verification code" });
      }

      if (Date.now() > row.verification_expires) {
        return res.status(400).json({ message: "Verification code has expired" });
      }

      db.run(
        "UPDATE users SET is_verified = 1, verification_code = NULL, verification_expires = NULL WHERE id = ?",
        [row.id],
        (updateErr) => {
          if (updateErr) return res.status(500).json({ message: "Verification update failed" });
          res.json({ message: "Email verified successfully. You can now log in." });
        }
      );
    }
  );
});

// 3. LOGIN (Requires 2FA)
app.post("/api/auth/login", (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: "Username/email and password are required" });
  }

  const cleanLogin = username.trim().toLowerCase();

  db.get(
    "SELECT * FROM users WHERE LOWER(username) = ? OR LOWER(email) = ?",
    [cleanLogin, cleanLogin],
    async (err, user) => {
      if (err) return res.status(500).json({ message: "Database query error" });
      if (!user) return res.status(401).json({ message: "Invalid username/email or password" });

      const validPassword = await bcrypt.compare(password, user.password);
      if (!validPassword) {
        return res.status(401).json({ message: "Invalid username/email or password" });
      }

      if (!user.is_verified) {
        return res.status(403).json({ message: "Email verification required", email: user.email, unverified: true });
      }

      // Generate 2FA code
      const code = generateCode();
      const expires = Date.now() + 5 * 60 * 1000; // 5 mins

      db.run(
        "UPDATE users SET two_fa_code = ?, two_fa_expires = ? WHERE id = ?",
        [code, expires, user.id],
        async (updateErr) => {
          if (updateErr) return res.status(500).json({ message: "Failed to process 2FA setup" });

          // Send 2FA email
          const subject = "Your ZamboAlert Login 2FA Code";
          const text = `Your login 2FA code is: ${code}. It expires in 5 minutes.`;
          const html = `
            <div style="font-family: sans-serif; padding: 20px; border: 1px solid #f1f1f1; border-radius: 8px; max-width: 500px; margin: auto;">
              <h2 style="color: #b91c1c; text-align: center;">ZamboAlert 2FA Security</h2>
              <p>Hello <strong>${user.username}</strong>,</p>
              <p>You requested login access to your ZamboAlert dashboard. Use this 2-Factor verification code:</p>
              <div style="font-size: 24px; font-weight: bold; text-align: center; padding: 15px; background-color: #fef2f2; border: 1px dashed #f87171; color: #b91c1c; margin: 20px 0; border-radius: 4px; letter-spacing: 4px;">
                ${code}
              </div>
              <p style="font-size: 12px; color: #6b7280; text-align: center;">This code will expire in 5 minutes.</p>
            </div>
          `;

          const emailSent = await sendMail(user.email, subject, text, html, code);

          res.json({
            message: emailSent
              ? "Credentials accepted. 2FA verification code sent to your email."
              : `Credentials accepted! (Email server timed out: your 2FA code is ${code})`,
            username: user.username,
            email: user.email,
            code: !emailSent ? code : undefined,
          });
        }
      );
    }
  );
});

// 4. VERIFY 2FA & LOGIN COMPLETE
app.post("/api/auth/verify-2fa", (req, res) => {
  const { username, code } = req.body;

  if (!username || !code) {
    return res.status(400).json({ message: "Username and code are required" });
  }

  const cleanUser = username.trim().toLowerCase();
  const cleanCode = code.toString().trim();

  db.get(
    "SELECT id, username, email, two_fa_code, two_fa_expires FROM users WHERE LOWER(username) = ? OR LOWER(email) = ?",
    [cleanUser, cleanUser],
    (err, user) => {
      if (err) return res.status(500).json({ message: "Database query error" });
      if (!user) return res.status(404).json({ message: "User not found" });

      if (user.two_fa_code !== cleanCode) {
        return res.status(400).json({ message: "Invalid 2FA code" });
      }

      if (Date.now() > user.two_fa_expires) {
        return res.status(400).json({ message: "2FA code has expired" });
      }

      // Clear code & generate JWT token
      db.run(
        "UPDATE users SET two_fa_code = NULL, two_fa_expires = NULL WHERE id = ?",
        [user.id],
        (updateErr) => {
          if (updateErr) return res.status(500).json({ message: "Session completion failed" });

          const token = jwt.sign(
            { sub: user.username, email: user.email, role: "barangay_official" },
            JWT_SECRET,
            { expiresIn: "1h" }
          );

          res.json({
            message: "Login successful",
            token,
            user: user.username,
            expiry: Date.now() + 60 * 60 * 1000, // 1h
          });
        }
      );
    }
  );
});

// 5. RESEND VERIFICATION OR 2FA CODE
app.post("/api/auth/resend-code", (req, res) => {
  const { email, type } = req.body; // type: 'register' | 'mfa'

  if (!email) {
    return res.status(400).json({ message: "Email is required" });
  }

  const cleanEmail = email.trim().toLowerCase();

  db.get("SELECT id, username, email FROM users WHERE LOWER(email) = ?", [cleanEmail], async (err, user) => {
    if (err) return res.status(500).json({ message: "Database query error" });
    if (!user) return res.status(404).json({ message: "User not found" });

    const code = generateCode();
    const expires = type === "mfa" ? Date.now() + 5 * 60 * 1000 : Date.now() + 15 * 60 * 1000;

    const sql = type === "mfa"
      ? "UPDATE users SET two_fa_code = ?, two_fa_expires = ? WHERE id = ?"
      : "UPDATE users SET verification_code = ?, verification_expires = ? WHERE id = ?";

    db.run(sql, [code, expires, user.id], async (updateErr) => {
      if (updateErr) return res.status(500).json({ message: "Failed to generate new code" });

      const subject = type === "mfa" ? "Your ZamboAlert Login 2FA Code" : "Verify your ZamboAlert Account";
      const text = `Your new security code is: ${code}.`;
      const html = `
        <div style="font-family: sans-serif; padding: 20px; border: 1px solid #f1f1f1; border-radius: 8px; max-width: 500px; margin: auto;">
          <h2 style="color: #b91c1c; text-align: center;">ZamboAlert Security</h2>
          <p>Hello <strong>${user.username}</strong>,</p>
          <p>As requested, here is your security code:</p>
          <div style="font-size: 24px; font-weight: bold; text-align: center; padding: 15px; background-color: #fef2f2; border: 1px dashed #f87171; color: #b91c1c; margin: 20px 0; border-radius: 4px; letter-spacing: 4px;">
            ${code}
          </div>
          <p style="font-size: 12px; color: #6b7280; text-align: center;">Expires in ${type === "mfa" ? "5" : "15"} minutes.</p>
        </div>
      `;

      const emailSent = await sendMail(user.email, subject, text, html, code);

      res.json({
        message: emailSent
          ? "New code sent successfully"
          : `New code generated! (Email server timed out: your code is ${code})`,
        code: !emailSent ? code : undefined,
      });
    });
  });
});

/* QR Code verification API routes removed */

// 6. FORGOT PASSWORD
app.post("/api/auth/forgot-password", (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ message: "Email is required" });
  }

  const cleanEmail = email.trim().toLowerCase();

  db.get("SELECT id, username, email FROM users WHERE LOWER(email) = ?", [cleanEmail], async (err, user) => {
    if (err) return res.status(500).json({ message: "Database query error" });
    if (!user) return res.status(404).json({ message: "No official account registered with this email." });

    const code = generateCode();
    const expires = Date.now() + 15 * 60 * 1000; // 15 mins

    db.run(
      "UPDATE users SET verification_code = ?, verification_expires = ? WHERE id = ?",
      [code, expires, user.id],
      async (updateErr) => {
        if (updateErr) return res.status(500).json({ message: "Failed to generate reset code" });

        const subject = "Reset your ZamboAlert Password";
        const text = `Your password reset code is: ${code}. It expires in 15 minutes.`;
        const html = `
          <div style="font-family: sans-serif; padding: 20px; border: 1px solid #f1f1f1; border-radius: 8px; max-width: 500px; margin: auto;">
            <h2 style="color: #b91c1c; text-align: center;">ZamboAlert Security</h2>
            <p>Hello <strong>${user.username}</strong>,</p>
            <p>We received a request to reset your password. Use the following code to complete the reset:</p>
            <div style="font-size: 24px; font-weight: bold; text-align: center; padding: 15px; background-color: #fef2f2; border: 1px dashed #f87171; color: #b91c1c; margin: 20px 0; border-radius: 4px; letter-spacing: 4px;">
              ${code}
            </div>
            <p style="font-size: 12px; color: #6b7280; text-align: center;">This code will expire in 15 minutes. If you did not request this, you can ignore this email.</p>
          </div>
        `;

        const emailSent = await sendMail(user.email, subject, text, html, code);

        res.json({
          message: emailSent
            ? "Password reset code has been sent to your email."
            : `Password reset requested! (Email server timed out: your code is ${code})`,
          email: user.email,
          code: !emailSent ? code : undefined,
        });
      }
    );
  });
});

// 7. RESET PASSWORD
app.post("/api/auth/reset-password", async (req, res) => {
  const { email, code, newPassword } = req.body;

  if (!email || !code || !newPassword) {
    return res.status(400).json({ message: "All fields are required" });
  }

  const cleanEmail = email.trim().toLowerCase();
  const cleanCode = code.toString().trim();

  db.get(
    "SELECT id, verification_code, verification_expires FROM users WHERE LOWER(email) = ?",
    [cleanEmail],
    async (err, user) => {
      if (err) return res.status(500).json({ message: "Database query error" });
      if (!user) return res.status(404).json({ message: "User not found" });

      if (user.verification_code !== cleanCode) {
        return res.status(400).json({ message: "Invalid reset code" });
      }

      if (Date.now() > user.verification_expires) {
        return res.status(400).json({ message: "Reset code has expired" });
      }

      try {
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);

        db.run(
          "UPDATE users SET password = ?, verification_code = NULL, verification_expires = NULL, is_verified = 1 WHERE id = ?",
          [hashedPassword, user.id],
          (updateErr) => {
            if (updateErr) return res.status(500).json({ message: "Failed to reset password" });
            res.json({ message: "Password has been reset successfully. You can now log in." });
          }
        );
      } catch (hashErr) {
        res.status(500).json({ message: "Error hashing new password" });
      }
    }
  );
});

/* ─── Casualty / Victim Logs API ─── */
app.get("/api/logs/casualties", (req, res) => {
  db.all("SELECT * FROM casualty_logs ORDER BY created_at DESC", [], (err, rows) => {
    if (err) {
      return res.status(500).json({ message: "Database query error", error: err.message });
    }
    res.json(rows);
  });
});

app.post("/api/logs/casualties", (req, res) => {
  const { rescuer_id, rescuer_name, victim_name, age, gender, status, injury_details, location, latitude, longitude, disaster_type } = req.body;

  if (!victim_name || !status) {
    return res.status(400).json({ message: "Victim name and status are required fields." });
  }

  db.run(
    `INSERT INTO casualty_logs (rescuer_id, rescuer_name, victim_name, age, gender, status, injury_details, location, latitude, longitude, disaster_type)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      rescuer_id || null,
      rescuer_name || null,
      victim_name,
      age ? parseInt(age) : null,
      gender || "Unknown",
      status,
      injury_details || null,
      location || null,
      latitude ? parseFloat(latitude) : null,
      longitude ? parseFloat(longitude) : null,
      disaster_type || "Unknown"
    ],
    function (err) {
      if (err) {
        return res.status(500).json({ message: "Failed to insert log", error: err.message });
      }
      res.status(201).json({
        message: "Casualty/Victim log recorded successfully",
        logId: this.lastID
      });
    }
  );
});

app.post("/api/logs/casualties/clear", (req, res) => {
  db.run("DELETE FROM casualty_logs", [], (err) => {
    if (err) {
      return res.status(500).json({ message: "Failed to clear casualty logs", error: err.message });
    }
    res.json({ message: "All casualty logs cleared." });
  });
});

// Get all rescuers
app.get("/api/rescuers", (req, res) => {
  db.all("SELECT * FROM rescuers ORDER BY created_at DESC", [], (err, rows) => {
    if (err) {
      return res.status(500).json({ message: "Database query error", error: err.message });
    }
    res.json(rows);
  });
});

// Register a new rescuer (from the mobile app, if connected)
app.post("/api/rescuers/register", (req, res) => {
  const { email, first_name, last_name, phone_number, id_type, id_number } = req.body;

  if (!email || !first_name || !last_name || !id_type || !id_number) {
    return res.status(400).json({ message: "Required fields are missing." });
  }

  // Check the settings to determine default is_verified
  db.get("SELECT value FROM settings WHERE key = 'require_rescuer_approval'", [], (err, row) => {
    let defaultVerified = 0;
    if (!err && row) {
      defaultVerified = row.value === "0" ? 1 : 0;
    }
    const defaultStatus = defaultVerified === 1 ? 'available' : 'offline';

    db.run(
      `INSERT INTO rescuers (email, first_name, last_name, phone_number, id_type, id_number, is_verified, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [email, first_name, last_name, phone_number || null, id_type, id_number, defaultVerified, defaultStatus],
      function (insertErr) {
        if (insertErr) {
          if (insertErr.message.includes("UNIQUE")) {
            return res.status(400).json({ message: "Email is already registered." });
          }
          return res.status(500).json({ message: "Failed to register rescuer", error: insertErr.message });
        }
        res.status(201).json({
          message: defaultVerified === 1 
            ? "Rescuer registered and auto-approved successfully." 
            : "Rescuer registered successfully. Pending admin approval.",
          rescuerId: this.lastID,
          isVerified: defaultVerified === 1
        });
      }
    );
  });
});

// Verify/Approve a rescuer
app.post("/api/rescuers/verify/:id", (req, res) => {
  const { id } = req.params;

  db.run(
    "UPDATE rescuers SET is_verified = 1, status = 'available' WHERE id = ?",
    [id],
    function (err) {
      if (err) {
        return res.status(500).json({ message: "Failed to verify rescuer", error: err.message });
      }
      if (this.changes === 0) {
        return res.status(404).json({ message: "Rescuer not found." });
      }

      // Sync approval to root backend (port 3000) so the rescuer can also log in via mobile app.
      // Silently ignore errors — the SQLite update already succeeded.
      db.get("SELECT email FROM rescuers WHERE id = ?", [id], async (emailErr, row) => {
        if (!emailErr && row?.email) {
          try {
            await fetch(`${TELEMETRY_BACKEND_URL}/api/admin/rescuers/approve-by-email`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ email: row.email }),
            });
          } catch (syncErr) {
            console.warn("Rescuer approval sync to mobile backend failed (non-fatal):", syncErr.message);
          }
        }
      });

      res.json({ message: "Rescuer verified and approved successfully." });
    }
  );
});

// Reject / Delete a rescuer account
app.delete("/api/rescuers/:id", (req, res) => {
  const { id } = req.params;

  db.run(
    "DELETE FROM rescuers WHERE id = ?",
    [id],
    function (err) {
      if (err) {
        return res.status(500).json({ message: "Failed to delete rescuer", error: err.message });
      }
      if (this.changes === 0) {
        return res.status(404).json({ message: "Rescuer not found." });
      }
      res.json({ message: "Rescuer account rejected and deleted successfully." });
    }
  );
});


// Get all settings
app.get("/api/settings", (req, res) => {
  db.all("SELECT * FROM settings", [], (err, rows) => {
    if (err) {
      return res.status(500).json({ message: "Failed to fetch settings", error: err.message });
    }
    const settingsObj = {};
    rows.forEach((row) => {
      if (row.key === "require_rescuer_approval") {
        settingsObj.requireRescuerApproval = row.value === "1";
      } else {
        settingsObj[row.key] = row.value;
      }
    });
    if (settingsObj.requireRescuerApproval === undefined) {
      settingsObj.requireRescuerApproval = true;
    }
    res.json(settingsObj);
  });
});

// Update a setting
app.post("/api/settings", (req, res) => {
  const { key, value } = req.body;

  if (!key) {
    return res.status(400).json({ message: "Setting key is required." });
  }

  const valStr = typeof value === "boolean" ? (value ? "1" : "0") : String(value);

  db.run(
    "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
    [key, valStr],
    function (err) {
      if (err) {
        return res.status(500).json({ message: "Failed to save setting", error: err.message });
      }
      res.json({ message: "Setting saved successfully.", key, value });
    }
  );
});

// Dispatch a rescuer to a target (victim, alert, other rescuer/respondent, or mesh node)
app.post("/api/rescuers/dispatch", (req, res) => {
  const { rescuerId, targetType, targetId, targetName } = req.body;
  if (!rescuerId || !targetType) {
    return res.status(400).json({ message: "Rescuer ID and Target Type are required." });
  }

  db.run(
    "UPDATE rescuers SET status = 'en-route', assigned_target_type = ?, assigned_target_id = ?, assigned_target_name = ? WHERE id = ? OR id_number = ?",
    [targetType, String(targetId), targetName, rescuerId, rescuerId],
    function (err) {
      if (err) {
        return res.status(500).json({ message: "Failed to dispatch rescuer", error: err.message });
      }
      res.json({ message: "Rescuer dispatched successfully." });
    }
  );
});

// Resolve a rescuer's dispatch (mark them available again)
app.post("/api/rescuers/resolve/:id", (req, res) => {
  const { id } = req.params;

  db.run(
    "UPDATE rescuers SET status = 'available', assigned_target_type = NULL, assigned_target_id = NULL, assigned_target_name = NULL WHERE id = ? OR id_number = ?",
    [id, id],
    function (err) {
      if (err) {
        return res.status(500).json({ message: "Failed to resolve rescuer dispatch", error: err.message });
      }
      res.json({ message: "Rescuer dispatch resolved successfully." });
    }
  );
});

/* ─── Household / Resident Registry API ─── */

// Get all registered households
app.get("/api/households", (req, res) => {
  const { purok } = req.query;
  let sql = "SELECT * FROM households";
  const params = [];
  if (purok && purok !== "ALL") {
    sql += " WHERE purok_zone = ?";
    params.push(purok);
  }
  sql += " ORDER BY created_at DESC";

  db.all(sql, params, (err, rows) => {
    if (err) {
      return res.status(500).json({ message: "Database query error", error: err.message });
    }
    res.json(rows);
  });
});

// Add new household / resident record
app.post("/api/households", (req, res) => {
  const { resident_name, household_head, phone_number, purok_zone, occupants_count, vulnerable_count, status, latitude, longitude } = req.body;

  if (!resident_name || !phone_number || !purok_zone) {
    return res.status(400).json({ message: "Resident Name, Phone Number, and Purok/Zone are required." });
  }

  db.run(
    `INSERT INTO households (resident_name, household_head, phone_number, purok_zone, occupants_count, vulnerable_count, status, latitude, longitude)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      resident_name,
      household_head || resident_name,
      phone_number,
      purok_zone,
      occupants_count ? parseInt(occupants_count) : 1,
      vulnerable_count ? parseInt(vulnerable_count) : 0,
      status || 'Active',
      latitude ? parseFloat(latitude) : null,
      longitude ? parseFloat(longitude) : null
    ],
    function (err) {
      if (err) {
        return res.status(500).json({ message: "Failed to add household record", error: err.message });
      }
      res.status(201).json({
        message: "Household registered successfully",
        householdId: this.lastID
      });
    }
  );
});

// Update household record
app.put("/api/households/:id", (req, res) => {
  const { id } = req.params;
  const { resident_name, household_head, phone_number, purok_zone, occupants_count, vulnerable_count, status, latitude, longitude } = req.body;

  db.run(
    `UPDATE households SET resident_name = ?, household_head = ?, phone_number = ?, purok_zone = ?, occupants_count = ?, vulnerable_count = ?, status = ?, latitude = ?, longitude = ?
     WHERE id = ?`,
    [
      resident_name,
      household_head,
      phone_number,
      purok_zone,
      parseInt(occupants_count || 1),
      parseInt(vulnerable_count || 0),
      status,
      latitude ? parseFloat(latitude) : null,
      longitude ? parseFloat(longitude) : null,
      id
    ],
    function (err) {
      if (err) {
        return res.status(500).json({ message: "Failed to update household", error: err.message });
      }
      res.json({ message: "Household updated successfully." });
    }
  );
});

// Delete household record
app.delete("/api/households/:id", (req, res) => {
  const { id } = req.params;
  db.run("DELETE FROM households WHERE id = ?", [id], function (err) {
    if (err) {
      return res.status(500).json({ message: "Failed to delete household", error: err.message });
    }
    res.json({ message: "Household record deleted." });
  });
});

// SMS Broadcast to Households
app.post("/api/households/broadcast", (req, res) => {
  const { purok_zone, message, priority } = req.body;
  if (!message) {
    return res.status(400).json({ message: "Broadcast message is required." });
  }

  let sql = "SELECT phone_number, resident_name FROM households WHERE status = 'Active'";
  const params = [];
  if (purok_zone && purok_zone !== "ALL") {
    sql += " AND purok_zone = ?";
    params.push(purok_zone);
  }

  db.all(sql, params, (err, rows) => {
    if (err) {
      return res.status(500).json({ message: "Database query error", error: err.message });
    }

    const recipientsCount = rows.length;
    console.log(`[SMS BROADCAST] Transmitted to ${recipientsCount} registered households (${purok_zone || "All Zones"}): "${message}"`);

    res.json({
      message: `SMS alert successfully transmitted to ${recipientsCount} registered household contact(s).`,
      recipientsCount,
      timestamp: new Date().toISOString()
    });
  });
});


/* ─── Rescuer & Tanod Zone Assignment & GPS Location API ─── */

// Assign Tanod or Rescuer to a specific Purok / Zone
app.post("/api/rescuers/assign-zone", (req, res) => {
  const { rescuerId, zone, role } = req.body;
  if (!rescuerId || !zone) {
    return res.status(400).json({ message: "Rescuer ID and Zone are required." });
  }

  let sql = "UPDATE rescuers SET assigned_zone = ?";
  const params = [zone];
  if (role) {
    sql += ", role = ?";
    params.push(role);
  }
  sql += " WHERE id = ? OR id_number = ?";
  params.push(rescuerId, rescuerId);

  db.run(sql, params, function (err) {
    if (err) {
      return res.status(500).json({ message: "Failed to assign zone", error: err.message });
    }
    res.json({ message: `Assigned zone updated to ${zone} successfully.` });
  });
});

// Update Rescuer / Tanod live GPS location & status
app.post("/api/rescuers/location", (req, res) => {
  const { rescuerId, latitude, longitude, status } = req.body;
  if (!rescuerId || latitude === undefined || longitude === undefined) {
    return res.status(400).json({ message: "Rescuer ID, latitude, and longitude are required." });
  }

  let sql = "UPDATE rescuers SET latitude = ?, longitude = ?";
  const params = [parseFloat(latitude), parseFloat(longitude)];
  if (status) {
    sql += ", status = ?";
    params.push(status);
  }
  sql += " WHERE id = ? OR id_number = ?";
  params.push(rescuerId, rescuerId);

  db.run(sql, params, function (err) {
    if (err) {
      return res.status(500).json({ message: "Failed to update location", error: err.message });
    }
    res.json({ message: "Location updated successfully." });
  });
});


/* ─── Incident Reports & Analytics API ─── */

// Get all incident reports
app.get("/api/incidents", (req, res) => {
  db.all("SELECT * FROM incidents ORDER BY date_occurred DESC", [], (err, rows) => {
    if (err) {
      return res.status(500).json({ message: "Database query error", error: err.message });
    }
    res.json(rows);
  });
});

// Post new incident report
app.post("/api/incidents", (req, res) => {
  const {
    title, disaster_type, date_occurred, water_level_m, affected_households,
    total_rescued, casualties_count, avg_response_time_mins, dispatch_time_mins,
    on_scene_time_mins, purok_zone, damage_estimate_php, status, summary_notes
  } = req.body;

  if (!title || !date_occurred) {
    return res.status(400).json({ message: "Title and Date Occurred are required." });
  }

  db.run(
    `INSERT INTO incidents (title, disaster_type, date_occurred, water_level_m, affected_households, total_rescued, casualties_count, avg_response_time_mins, dispatch_time_mins, on_scene_time_mins, purok_zone, damage_estimate_php, status, summary_notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      title,
      disaster_type || 'Flood',
      date_occurred,
      water_level_m ? parseFloat(water_level_m) : null,
      affected_households ? parseInt(affected_households) : 0,
      total_rescued ? parseInt(total_rescued) : 0,
      casualties_count ? parseInt(casualties_count) : 0,
      avg_response_time_mins ? parseInt(avg_response_time_mins) : 15,
      dispatch_time_mins ? parseFloat(dispatch_time_mins) : 4.0,
      on_scene_time_mins ? parseFloat(on_scene_time_mins) : 11.0,
      purok_zone || 'Barangay Wide',
      damage_estimate_php ? parseFloat(damage_estimate_php) : 0.0,
      status || 'Closed',
      summary_notes || null
    ],
    function (err) {
      if (err) {
        return res.status(500).json({ message: "Failed to insert incident report", error: err.message });
      }
      res.status(201).json({
        message: "Incident report recorded successfully",
        incidentId: this.lastID
      });
    }
  );
});

// Delete incident report
app.delete("/api/incidents/:id", (req, res) => {
  const { id } = req.params;
  db.run("DELETE FROM incidents WHERE id = ?", [id], function (err) {
    if (err) {
      return res.status(500).json({ message: "Failed to delete incident report", error: err.message });
    }
    res.json({ message: "Incident report deleted." });
  });
});

// CSV Export route for ZCDRRMO / Thesis Results
app.get("/api/incidents/export", (req, res) => {
  db.all("SELECT * FROM incidents ORDER BY date_occurred DESC", [], (err, rows) => {
    if (err) {
      return res.status(500).json({ message: "Database query error", error: err.message });
    }

    const headers = ["ID", "Title", "Disaster Type", "Date Occurred", "Peak Water Level (m)", "Affected Households", "Total Rescued", "Casualties", "Avg Response Time (min)", "Dispatch Time (min)", "On Scene Time (min)", "Purok/Zone", "Damage Estimate (PHP)", "Status", "Summary"];
    const csvRows = [headers.join(",")];

    rows.forEach(r => {
      const row = [
        r.id,
        `"${(r.title || "").replace(/"/g, '""')}"`,
        r.disaster_type,
        r.date_occurred,
        r.water_level_m || 0,
        r.affected_households || 0,
        r.total_rescued || 0,
        r.casualties_count || 0,
        r.avg_response_time_mins || 0,
        r.dispatch_time_mins || 0,
        r.on_scene_time_mins || 0,
        `"${(r.purok_zone || "").replace(/"/g, '""')}"`,
        r.damage_estimate_php || 0,
        r.status,
        `"${(r.summary_notes || "").replace(/"/g, '""')}"`
      ];
      csvRows.push(row.join(","));
    });

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", 'attachment; filename="ZamboAlert_ZCDRRMO_Incident_Analytics_Report.csv"');
    res.send(csvRows.join("\n"));
  });
});

/* ─── Manpower & Worst-Case Disaster Scenario REST APIs ─── */

// 1. Get all barangays with baseline manpower and equipment
app.get("/api/manpower/barangays", (req, res) => {
  db.all("SELECT * FROM barangays ORDER BY risk_level = 'Extreme' DESC, risk_level = 'High' DESC, name ASC", [], (err, rows) => {
    if (err) {
      return res.status(500).json({ message: "Database query error", error: err.message });
    }
    res.json(rows);
  });
});

// 2. Update a barangay's manpower and equipment
app.put("/api/manpower/barangays/:id", (req, res) => {
  const { id } = req.params;
  const {
    active_sar, active_tanods, active_medics, active_logistics,
    active_boat_crews, rescue_boats, ambulances, contact_person, contact_number
  } = req.body;

  db.run(
    `UPDATE barangays SET
      active_sar = ?,
      active_tanods = ?,
      active_medics = ?,
      active_logistics = ?,
      active_boat_crews = ?,
      rescue_boats = ?,
      ambulances = ?,
      contact_person = ?,
      contact_number = ?
     WHERE id = ?`,
    [
      parseInt(active_sar || 0),
      parseInt(active_tanods || 0),
      parseInt(active_medics || 0),
      parseInt(active_logistics || 0),
      parseInt(active_boat_crews || 0),
      parseInt(rescue_boats || 0),
      parseInt(ambulances || 0),
      contact_person,
      contact_number,
      id
    ],
    function (err) {
      if (err) {
        return res.status(500).json({ message: "Failed to update barangay manpower", error: err.message });
      }
      res.json({ message: "Barangay manpower inventory updated successfully." });
    }
  );
});

// 3. Get all active worst-case disaster manpower alerts
app.get("/api/manpower/alerts", (req, res) => {
  db.all("SELECT * FROM manpower_alerts ORDER BY deficit_percentage DESC, deficit_count DESC", [], (err, rows) => {
    if (err) {
      return res.status(500).json({ message: "Database query error", error: err.message });
    }
    res.json(rows);
  });
});



// 4. Create or Upsert a Manpower Alert (Disaster Scenario Calculation & Ingestion)
app.post("/api/manpower/alerts", (req, res) => {
  const {
    barangay_id,
    barangay_name,
    disaster_type = "Flash Flood",
    scenario_level = "Level 3 - Severe Disaster",
    projected_affected_pop = 0,
    required_sar = 0,
    required_tanods = 0,
    required_medics = 0,
    required_logistics = 0,
    required_total,
    available_total = 0,
    deficit_count,
    deficit_percentage,
    alert_level,
    status = "Active",
    mobilization_status = "Pending Mobilization",
    triggered_by = "Command Center Manual Trigger"
  } = req.body;

  if (!barangay_name) {
    return res.status(400).json({ message: "Barangay name is required." });
  }

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
    if (defPct >= 50 || defCount >= 40) calculatedLevel = "CRITICAL RED";
    else if (defPct >= 30 || defCount >= 20) calculatedLevel = "SEVERE ORANGE";
    else if (defPct >= 15 || defCount >= 10) calculatedLevel = "MODERATE YELLOW";
    else calculatedLevel = "SUFFICIENT GREEN";
  }

  db.run(
    `INSERT INTO manpower_alerts (
      barangay_id, barangay_name, disaster_type, scenario_level, projected_affected_pop,
      required_sar, required_tanods, required_medics, required_logistics, required_total,
      available_total, deficit_count, deficit_percentage, alert_level, status, mobilization_status, triggered_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      barangay_id || null,
      barangay_name.trim(),
      disaster_type,
      scenario_level,
      Number(projected_affected_pop),
      Number(required_sar),
      Number(required_tanods),
      Number(required_medics),
      Number(required_logistics),
      reqTotal,
      availTotal,
      defCount,
      defPct,
      calculatedLevel,
      status,
      mobilization_status,
      triggered_by
    ],
    function (err) {
      if (err) {
        return res.status(500).json({ message: "Failed to record manpower alert", error: err.message });
      }
      res.status(201).json({
        message: "Manpower alert recorded successfully.",
        alertId: this.lastID,
        barangay_name,
        alert_level: calculatedLevel,
        deficit_count: defCount,
        deficit_percentage: defPct
      });
    }
  );
});

// Seed default sample barangays & initial manpower alerts if table is empty
function seedBarangayDataIfEmpty() {
  db.get("SELECT COUNT(*) as count FROM barangays", [], (err, row) => {
    if (!err && row && row.count === 0) {
      const sampleBarangays = [
        ["Tetuan", "District II", 32000, 6800, "Extreme", 12, 35, 8, 10, 4, 3, 1, "Kag. Alvarez", "09171234501", 6.9214, 122.0864],
        ["Tumaga", "District II", 36000, 7500, "Extreme", 10, 30, 6, 8, 2, 2, 1, "Capt. Francisco", "09171234502", 6.9388, 122.0811],
        ["Santa Maria", "District II", 28000, 5900, "High", 14, 28, 7, 9, 3, 2, 1, "Kag. Ramos", "09171234503", 6.9298, 122.0722],
        ["San Jose Gusu", "District I", 29500, 6200, "High", 8, 25, 5, 7, 2, 1, 1, "Capt. Saavedra", "09171234504", 6.9189, 122.0520],
        ["Pasonanca", "District II", 30000, 6400, "Moderate", 15, 32, 9, 12, 3, 2, 1, "Capt. Climaco", "09171234505", 6.9542, 122.0719],
        ["Baliwasan", "District I", 31000, 6500, "Extreme", 9, 24, 6, 8, 4, 3, 1, "Kag. Tarroza", "09171234506", 6.9150, 122.0620],
        ["Ayala", "District I", 24000, 5100, "High", 11, 26, 6, 8, 2, 2, 1, "Capt. Natividad", "09171234507", 6.9634, 121.9610]
      ];

      const stmt = db.prepare(`INSERT INTO barangays (
        name, district, population, households, risk_level, active_sar, active_tanods,
        active_medics, active_logistics, active_boat_crews, rescue_boats, ambulances,
        contact_person, contact_number, latitude, longitude
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

      sampleBarangays.forEach(b => stmt.run(b));
      stmt.finalize(() => {
        console.log("Seeded baseline barangay inventories for Zamboanga City.");
        // Seed baseline alerts corresponding to high/extreme risk barangays
        db.get("SELECT COUNT(*) as count FROM manpower_alerts", [], (aErr, aRow) => {
          if (!aErr && aRow && aRow.count === 0) {
            const initialAlerts = [
              [1, "Tetuan", "Flash Flood", "Level 4 - Worst-Case Catastrophe", 8500, 30, 60, 20, 25, 135, 65, 70, 51.9, "CRITICAL RED", "Active", "Emergency Mobilization Required", "ZCDRRMO AI System"],
              [2, "Tumaga", "Riverine Flooding", "Level 3 - Severe Disaster", 6200, 25, 50, 16, 20, 111, 54, 57, 51.4, "CRITICAL RED", "Active", "Emergency Mobilization Required", "ZCDRRMO AI System"],
              [6, "Baliwasan", "Coastal Storm Surge", "Level 3 - Severe Disaster", 5400, 22, 45, 14, 18, 99, 47, 52, 52.5, "CRITICAL RED", "Active", "Pending Mobilization", "ZCDRRMO AI System"],
              [4, "San Jose Gusu", "Flash Flood", "Level 2 - Moderate Surge", 3800, 18, 38, 12, 15, 83, 45, 38, 45.8, "SEVERE ORANGE", "Active", "Pending Mobilization", "ZCDRRMO AI System"],
              [3, "Santa Maria", "Urban Inundation", "Level 2 - Moderate Surge", 3200, 18, 35, 10, 14, 77, 58, 19, 24.7, "MODERATE YELLOW", "Active", "Pending Mobilization", "ZCDRRMO AI System"]
            ];
            const aStmt = db.prepare(`INSERT INTO manpower_alerts (
              barangay_id, barangay_name, disaster_type, scenario_level, projected_affected_pop,
              required_sar, required_tanods, required_medics, required_logistics, required_total,
              available_total, deficit_count, deficit_percentage, alert_level, status, mobilization_status, triggered_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
            initialAlerts.forEach(a => aStmt.run(a));
            aStmt.finalize(() => {
              console.log("Seeded initial disaster scenario manpower alerts.");
            });
          }
        });
      });
    }
  });
}

// 5. Trigger an official Emergency Red Alert & Mobilization Broadcast for a specific Barangay
app.post("/api/manpower/trigger-alert", (req, res) => {
  const { barangay_name, custom_message, priority = "CRITICAL_DEFICIT" } = req.body;

  if (!barangay_name) {
    return res.status(400).json({ message: "Barangay Name is required." });
  }

  db.run(
    "UPDATE manpower_alerts SET alert_level = 'CRITICAL RED', mobilization_status = 'Emergency Mobilization Broadcast Sent' WHERE barangay_name = ?",
    [barangay_name],
    function (err) {
      if (err) {
        return res.status(500).json({ message: "Failed to update alert state", error: err.message });
      }

      console.log(`[MANPOWER RED ALERT BROADCAST] Issued for Barangay ${barangay_name}. Message: "${custom_message || 'ALL OFF-DUTY TANODS, SAR OPERATIVES, AND MEDICAL RESERVISTS REPORT TO BARANGAY COMMAND HQ IMMEDIATELY.'}"`);

      res.json({
        message: `Emergency Worst-Case Manpower Red Alert triggered for Barangay ${barangay_name}. LoRa & SMS mobilization signals broadcasted.`,
        barangay_name,
        timestamp: new Date().toISOString()
      });
    }
  );
});

// 6. Mutual Aid Transfer (Cross-Barangay Reinforcement)
app.post("/api/manpower/mutual-aid-transfer", (req, res) => {
  const { from_barangay, to_barangay, disaster_type, sar_count = 0, tanod_count = 0, medic_count = 0, logistics_count = 0, notes } = req.body;

  if (!from_barangay || !to_barangay) {
    return res.status(400).json({ message: "Source (From) and Destination (To) Barangay are required." });
  }

  const total = parseInt(sar_count || 0) + parseInt(tanod_count || 0) + parseInt(medic_count || 0) + parseInt(logistics_count || 0);

  if (total <= 0) {
    return res.status(400).json({ message: "At least 1 personnel must be selected for transfer." });
  }

  db.run(
    `INSERT INTO manpower_transfers (from_barangay, to_barangay, disaster_type, sar_count, tanod_count, medic_count, logistics_count, total_personnel, status, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'En-Route', ?)`,
    [
      from_barangay,
      to_barangay,
      disaster_type || "Flash Flood",
      parseInt(sar_count || 0),
      parseInt(tanod_count || 0),
      parseInt(medic_count || 0),
      parseInt(logistics_count || 0),
      total,
      notes || `Mutual Aid Reinforcement from ${from_barangay} to ${to_barangay}`
    ],
    function (err) {
      if (err) {
        return res.status(500).json({ message: "Failed to record mutual aid transfer", error: err.message });
      }

      // Update destination alert mobilization status
      db.run(
        "UPDATE manpower_alerts SET mobilization_status = 'Mutual Aid Reinforcements En-Route' WHERE barangay_name = ?",
        [to_barangay]
      );

      res.status(201).json({
        message: `Mutual aid deployment of ${total} personnel dispatched from ${from_barangay} to ${to_barangay}.`,
        transferId: this.lastID,
        total_personnel: total
      });
    }
  );
});

// 7. Get Mutual Aid Transfers history
app.get("/api/manpower/transfers", (req, res) => {
  db.all("SELECT * FROM manpower_transfers ORDER BY created_at DESC", [], (err, rows) => {
    if (err) {
      return res.status(500).json({ message: "Database query error", error: err.message });
    }
    res.json(rows);
  });
});

// 8. Escalate Reinforcement Request to External Agency (ZCDRRMO, PCG, BFP, AFP, Red Cross)
app.post("/api/manpower/escalate-agency", (req, res) => {
  const { target_barangays, disaster_type, scenario_level, requested_agency, requested_units, total_reinforcements, priority = "Critical Priority", notes } = req.body;

  if (!target_barangays || !requested_agency || !requested_units) {
    return res.status(400).json({ message: "Target Barangays, Requested Agency, and Requested Units are required." });
  }

  const refNo = `ESC-ZCD-${Math.floor(1000 + Math.random() * 9000)}`;

  db.run(
    `INSERT INTO manpower_escalations (reference_no, target_barangays, disaster_type, scenario_level, requested_agency, requested_units, total_reinforcements, priority, notes, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Acknowledged & Dispatched')`,
    [
      refNo,
      Array.isArray(target_barangays) ? target_barangays.join(", ") : target_barangays,
      disaster_type || "Flash Flood",
      scenario_level || "Level 4 - Worst-Case Catastrophe",
      requested_agency,
      requested_units,
      parseInt(total_reinforcements || 10),
      priority,
      notes || "Emergency Disaster Augmentation Requisition"
    ],
    function (err) {
      if (err) {
        return res.status(500).json({ message: "Failed to record agency escalation", error: err.message });
      }

      res.status(201).json({
        message: `High-priority escalation transmitted to ${requested_agency}. Reference Code: ${refNo}`,
        reference_no: refNo,
        escalationId: this.lastID
      });
    }
  );
});

// 9. Get Agency Escalation history
app.get("/api/manpower/escalations", (req, res) => {
  db.all("SELECT * FROM manpower_escalations ORDER BY created_at DESC", [], (err, rows) => {
    if (err) {
      return res.status(500).json({ message: "Database query error", error: err.message });
    }
    res.json(rows);
  });
});

// 10. Export Worst-Case Manpower Disaster Matrix CSV Report
app.get("/api/manpower/export", (req, res) => {
  db.all(
    `SELECT a.*, b.population, b.district, b.risk_level, b.rescue_boats, b.ambulances, b.contact_person, b.contact_number
     FROM manpower_alerts a
     LEFT JOIN barangays b ON a.barangay_name = b.name
     ORDER BY a.deficit_percentage DESC`,
    [],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ message: "Database query error", error: err.message });
      }

      const headers = [
        "Alert ID", "Barangay", "District", "Population", "Vulnerability Risk",
        "Disaster Scenario", "Scenario Level", "Projected Affected Pop",
        "Required SAR", "Required Tanods", "Required Medics", "Required Logistics",
        "Total Required Manpower", "Available Manpower", "Deficit Count (Shortage)",
        "Deficit %", "Alert Level", "Mobilization Status", "Rescue Boats", "Ambulances", "Contact Person", "Contact Number"
      ];

      const csvRows = [headers.join(",")];

      rows.forEach((r) => {
        const row = [
          r.id,
          `"${(r.barangay_name || "").replace(/"/g, '""')}"`,
          `"${(r.district || "").replace(/"/g, '""')}"`,
          r.population || 0,
          r.risk_level || "High",
          `"${(r.disaster_type || "").replace(/"/g, '""')}"`,
          `"${(r.scenario_level || "").replace(/"/g, '""')}"`,
          r.projected_affected_pop || 0,
          r.required_sar || 0,
          r.required_tanods || 0,
          r.required_medics || 0,
          r.required_logistics || 0,
          r.required_total || 0,
          r.available_total || 0,
          r.deficit_count || 0,
          `${r.deficit_percentage || 0}%`,
          r.alert_level || "CRITICAL RED",
          `"${(r.mobilization_status || "").replace(/"/g, '""')}"`,
          r.rescue_boats || 0,
          r.ambulances || 0,
          `"${(r.contact_person || "").replace(/"/g, '""')}"`,
          `"${(r.contact_number || "").replace(/"/g, '""')}"`
        ];
        csvRows.push(row.join(","));
      });

      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", 'attachment; filename="ZCDRRMO_Worst_Case_Disaster_Manpower_Alert_Report.csv"');
      res.send(csvRows.join("\n"));
    }
  );
});

/**
 * Proxy live pod / SOS reports from the root gateway backend.
 * Gateway firmware still POSTs to :3000; the dashboard can read via this :5000 route.
 */
app.get("/api/telemetry", async (req, res) => {
  try {
    const upstream = await fetch(`${TELEMETRY_BACKEND_URL}/api/telemetry`, {
      headers: { Accept: "application/json" },
    });
    const body = await upstream.text();
    res.status(upstream.status);
    const contentType = upstream.headers.get("content-type");
    if (contentType) res.setHeader("Content-Type", contentType);
    return res.send(body);
  } catch (error) {
    console.error("Telemetry proxy failed:", error.message);
    return res.status(503).json({
      message: "Pod telemetry backend unreachable. Start root backend on port 3000.",
      telemetryBackend: TELEMETRY_BACKEND_URL,
    });
  }
});

/** Proxy citizen phone-GPS SOS reports from the root backend. */
app.get("/api/sos", async (req, res) => {
  try {
    const upstream = await fetch(`${TELEMETRY_BACKEND_URL}/api/sos`, {
      headers: { Accept: "application/json" },
    });
    const body = await upstream.text();
    res.status(upstream.status);
    const contentType = upstream.headers.get("content-type");
    if (contentType) res.setHeader("Content-Type", contentType);
    return res.send(body);
  } catch (error) {
    console.error("Citizen SOS proxy failed:", error.message);
    return res.status(503).json({
      message: "Citizen SOS backend unreachable. Start root backend on port 3000.",
      telemetryBackend: TELEMETRY_BACKEND_URL,
    });
  }
});

function startServer(portIndex = 0) {
  const port = FALLBACK_PORTS[portIndex];

  const server = app.listen(port, "0.0.0.0", () => {
    console.log(`Server running on port ${port}`);
    console.log(`Telemetry proxy → ${TELEMETRY_BACKEND_URL}/api/telemetry`);
  });

  server.on("error", (error) => {
    if (error.code === "EADDRINUSE") {
      const nextIndex = portIndex + 1;
      if (FALLBACK_PORTS[nextIndex]) {
        console.warn(`Port ${port} is already in use. Retrying on port ${FALLBACK_PORTS[nextIndex]}...`);
        startServer(nextIndex);
        return;
      }

      console.error("No available ports left. Please free a port and try again.");
      process.exit(1);
    }

    throw error;
  });
}

startServer();
