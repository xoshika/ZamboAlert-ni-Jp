/**
 * database.js — Unified SQLite Database for ZamboAlert
 *
 * Replaces both the old db.json (root backend) and zamboalert.db (web backend)
 * with a single SQLite database: backend/src/zamboalert.db
 *
 * Tables:
 *  - users            (mobile + web auth, all roles)
 *  - rescuers         (registered rescue personnel with verification status)
 *  - casualty_logs    (victim / casualty tracking)
 *  - settings         (system dispatch rules)
 *  - households       (barangay household registry)
 *  - incidents        (incident & analytics logs)
 *  - barangays        (barangay manpower inventory)
 *  - manpower_alerts  (worst-case disaster scenario alerts)
 *  - manpower_transfers (cross-barangay mutual aid)
 *  - manpower_escalations (external agency escalations)
 *
 * In-memory structures (NOT persisted — reset on restart):
 *  - podTelemetry[]   (LoRa gateway hardware pods — 90s TTL)
 *  - citizenSos[]     (citizen phone GPS SOS — 10min TTL)
 */

const sqlite3 = require('sqlite3');
const path = require('path');

const DB_PATH = process.env.ZAMBOALERT_DB_PATH || path.join(__dirname, 'zamboalert.db');

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('Database connection error:', err.message);
    process.exit(1);
  }
  console.log(`[DB] Connected to SQLite database at ${DB_PATH}`);
  db.run('PRAGMA journal_mode=WAL');
  db.run('PRAGMA foreign_keys=ON');
  createTables();
});

function createTables() {
  db.serialize(() => {
    // ── Users (Mobile + Web accounts) ─────────────────────────────────────────
    db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        username TEXT,
        password_hash TEXT NOT NULL,
        password_bcrypt TEXT,
        role TEXT NOT NULL DEFAULT 'citizen',
        is_verified INTEGER DEFAULT 0,
        is_rescuer_verified INTEGER,
        failed_attempts INTEGER DEFAULT 0,
        mfa_enabled INTEGER DEFAULT 0,
        contact_number TEXT,
        phone_number TEXT,
        id_type TEXT,
        id_number TEXT,
        id_front_uri TEXT,
        id_back_uri TEXT,
        email_verification_code_hash TEXT,
        email_verification_expires_at INTEGER,
        two_fa_code TEXT,
        two_fa_expires INTEGER,
        password_reset_code TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Alter table to add any missing columns for existing installs
    const userCols = ['username', 'password_bcrypt', 'two_fa_code', 'two_fa_expires', 'password_reset_code'];
    userCols.forEach(col => {
      db.run(`ALTER TABLE users ADD COLUMN ${col} TEXT`, () => {});
    });

    // ── Rescuers (web admin approval panel) ──────────────────────────────────
    db.run(`
      CREATE TABLE IF NOT EXISTS rescuers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        phone_number TEXT,
        id_type TEXT NOT NULL,
        id_number TEXT NOT NULL,
        is_verified INTEGER DEFAULT 0,
        status TEXT DEFAULT 'available',
        assigned_target_type TEXT,
        assigned_target_id TEXT,
        assigned_target_name TEXT,
        role TEXT DEFAULT 'Rescuer',
        assigned_zone TEXT DEFAULT 'Unassigned',
        latitude REAL,
        longitude REAL,
        response_status TEXT DEFAULT 'available',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // ── Casualty / Victim logs ────────────────────────────────────────────────
    db.run(`
      CREATE TABLE IF NOT EXISTS casualty_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        rescuer_id TEXT,
        rescuer_name TEXT,
        victim_name TEXT NOT NULL,
        age INTEGER,
        gender TEXT,
        status TEXT NOT NULL,
        injury_details TEXT,
        location TEXT,
        latitude REAL,
        longitude REAL,
        disaster_type TEXT DEFAULT 'Unknown',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // ── Settings ──────────────────────────────────────────────────────────────
    db.run(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
      )
    `, () => {
      db.get("SELECT COUNT(*) as count FROM settings", [], (err, row) => {
        if (!err && row && row.count === 0) {
          db.run("INSERT INTO settings (key, value) VALUES ('require_rescuer_approval', '1')");
          console.log('[DB] Seeded default settings.');
        }
      });
    });

    // ── Households / Resident Registry ────────────────────────────────────────
    db.run(`
      CREATE TABLE IF NOT EXISTS households (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        resident_name TEXT NOT NULL,
        household_head TEXT NOT NULL,
        phone_number TEXT NOT NULL,
        purok_zone TEXT NOT NULL,
        occupants_count INTEGER DEFAULT 1,
        vulnerable_count INTEGER DEFAULT 0,
        status TEXT DEFAULT 'Active',
        latitude REAL,
        longitude REAL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // ── Incidents & Analytics ─────────────────────────────────────────────────
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

    // ── Barangays (manpower inventory) ────────────────────────────────────────
    db.run(`
      CREATE TABLE IF NOT EXISTS barangays (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        district TEXT NOT NULL,
        population INTEGER NOT NULL,
        households INTEGER NOT NULL,
        risk_level TEXT NOT NULL,
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

    // ── Manpower Alerts ───────────────────────────────────────────────────────
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
        alert_level TEXT NOT NULL,
        status TEXT DEFAULT 'Active',
        mobilization_status TEXT DEFAULT 'Pending Mobilization',
        triggered_by TEXT DEFAULT 'ZCDRRMO AI System',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // ── Manpower Transfers ────────────────────────────────────────────────────
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
        status TEXT DEFAULT 'En-Route',
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // ── Manpower Escalations ──────────────────────────────────────────────────
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

// ── In-memory live data stores (reset on restart, no persistence needed) ──────
const podTelemetry = [];   // LoRa hardware pods
const citizenSos = [];     // Citizen phone GPS SOS beacons

module.exports = { db, podTelemetry, citizenSos };
