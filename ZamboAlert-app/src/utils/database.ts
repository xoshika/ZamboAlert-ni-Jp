import * as SQLite from 'expo-sqlite';

let db: SQLite.SQLiteDatabase | null = null;

export const initDatabase = async () => {
  if (!db) {
    db = await SQLite.openDatabaseAsync('zamboalert_offline.db');
  }

  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS victims (
      id TEXT PRIMARY KEY NOT NULL,
      label TEXT,
      distance REAL,
      bearing INTEGER,
      floor INTEGER,
      signalStrength INTEGER,
      situation TEXT,
      heartRate INTEGER,
      temp REAL,
      lastPing TEXT
    );
    CREATE TABLE IF NOT EXISTS mesh_nodes (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT,
      role TEXT,
      battery INTEGER,
      signal INTEGER,
      status TEXT,
      location TEXT,
      hops INTEGER
    );
    CREATE TABLE IF NOT EXISTS logs (
      id TEXT PRIMARY KEY NOT NULL,
      time TEXT,
      type TEXT,
      message TEXT
    );
  `);
  
  return db;
};

export const getDatabase = () => db;

// Basic CRUD operations for Victims
export const insertVictim = async (victim: any) => {
  if (!db) return;
  const result = await db.runAsync(
    'INSERT OR REPLACE INTO victims (id, label, distance, bearing, floor, signalStrength, situation, heartRate, temp, lastPing) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [victim.id, victim.label, victim.distance, victim.bearing, victim.floor, victim.signalStrength, victim.situation, victim.heartRate, victim.temp, victim.lastPing]
  );
  return result.lastInsertRowId;
};

export const getVictims = async () => {
  if (!db) return [];
  const allRows = await db.getAllAsync('SELECT * FROM victims');
  return allRows;
};

// Basic CRUD operations for Logs
export const insertLog = async (log: any) => {
    if (!db) return;
    const result = await db.runAsync(
      'INSERT OR REPLACE INTO logs (id, time, type, message) VALUES (?, ?, ?, ?)',
      [log.id, log.time, log.type, log.message]
    );
    return result.lastInsertRowId;
};
  
export const getLogs = async () => {
    if (!db) return [];
    const allRows = await db.getAllAsync('SELECT * FROM logs');
    return allRows;
};
