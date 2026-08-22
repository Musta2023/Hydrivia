import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import bcrypt from 'bcryptjs';
import { fileURLToPath } from 'url';
import { config } from '../config/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbDir = path.resolve(__dirname, '../../data');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.resolve(dbDir, 'hydrivia.sqlite');
const db = new Database(dbPath);

// Enable WAL mode for high performance
db.pragma('journal_mode = WAL');

export function initDatabase() {
  // 1. Users table
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT DEFAULT 'admin',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 2. Sensor Readings (Telemetry history)
  db.exec(`
    CREATE TABLE IF NOT EXISTS sensor_readings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      zone1_soil REAL,
      zone2_soil REAL,
      zone3_soil REAL,
      water_level REAL,
      volume_liters REAL,
      temperature REAL,
      air_humidity REAL,
      pump_running INTEGER,
      valve1 INTEGER,
      valve2 INTEGER,
      valve3 INTEGER
    );
  `);

  // 3. Irrigation Cycles (Water Consumption tracking)
  db.exec(`
    CREATE TABLE IF NOT EXISTS irrigation_cycles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      zone_id INTEGER NOT NULL,
      plant TEXT NOT NULL,
      requested_liters REAL,
      target_soil_moisture REAL,
      delivered_liters REAL,
      start_time DATETIME DEFAULT CURRENT_TIMESTAMP,
      end_time DATETIME,
      status TEXT DEFAULT 'running', -- 'completed', 'stopped', 'emergency_stop'
      reason TEXT
    );
  `);

  // 4. Alerts table
  db.exec(`
    CREATE TABLE IF NOT EXISTS alerts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      severity TEXT NOT NULL, -- 'info', 'medium', 'high', 'critical'
      message TEXT NOT NULL,
      timestamp_ms INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 5. System Logs (Audit trail)
  db.exec(`
    CREATE TABLE IF NOT EXISTS system_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_type TEXT NOT NULL,
      description TEXT NOT NULL,
      user_email TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 6. Settings table
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);

  // Seed default admin user if not present
  const adminExists = db.prepare('SELECT id FROM users WHERE email = ?').get(config.admin.email);
  if (!adminExists) {
    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync(config.admin.password, salt);
    db.prepare('INSERT INTO users (email, password_hash, role) VALUES (?, ?, ?)').run(
      config.admin.email,
      hash,
      'admin'
    );
    console.log(`[DB] Admin user created: ${config.admin.email}`);
  }

  // Seed initial sample historical data if empty
  const readingCount = db.prepare('SELECT COUNT(*) as count FROM sensor_readings').get().count;
  if (readingCount === 0) {
    seedInitialHistory();
  }
}

function seedInitialHistory() {
  console.log('[DB] Seeding realistic historical data for charts & analytics...');
  const insertReading = db.prepare(`
    INSERT INTO sensor_readings (timestamp, zone1_soil, zone2_soil, zone3_soil, water_level, volume_liters, temperature, air_humidity, pump_running, valve1, valve2, valve3)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertCycle = db.prepare(`
    INSERT INTO irrigation_cycles (zone_id, plant, requested_liters, target_soil_moisture, delivered_liters, start_time, end_time, status, reason)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertAlert = db.prepare(`
    INSERT INTO alerts (type, severity, message, timestamp_ms, created_at)
    VALUES (?, ?, ?, ?, ?)
  `);

  const insertLog = db.prepare(`
    INSERT INTO system_logs (event_type, description, user_email, created_at)
    VALUES (?, ?, ?, ?)
  `);

  const now = Date.now();
  const plants = ['Tomate', 'Menthe', 'Oignon'];

  // Seed 24h of sensor telemetry (every 1 hour)
  for (let i = 24; i >= 0; i--) {
    const t = new Date(now - i * 3600 * 1000).toISOString();
    const temp = (22 + Math.sin(i / 3) * 5 + (Math.random() - 0.5) * 2).toFixed(1);
    const hum = (55 + Math.cos(i / 3) * 12 + (Math.random() - 0.5) * 3).toFixed(1);
    const z1 = (45 + Math.sin(i / 4) * 8 + (Math.random() - 0.5) * 2).toFixed(1);
    const z2 = (52 + Math.cos(i / 4) * 10 + (Math.random() - 0.5) * 2).toFixed(1);
    const z3 = (38 + Math.sin(i / 3) * 6 + (Math.random() - 0.5) * 2).toFixed(1);
    const level = (78 - i * 0.4 + (Math.random() - 0.5)).toFixed(1);
    const volume = ((level / 100) * 7000).toFixed(1);

    insertReading.run(t, z1, z2, z3, level, volume, temp, hum, 0, 0, 0, 0);
  }

  // Seed past 7 days of completed irrigation cycles
  for (let d = 7; d >= 1; d--) {
    for (let z = 1; z <= 3; z++) {
      const startTime = new Date(now - d * 24 * 3600 * 1000 + z * 3600 * 1000).toISOString();
      const endTime = new Date(now - d * 24 * 3600 * 1000 + z * 3600 * 1000 + 12 * 60 * 1000).toISOString();
      const reqL = [40, 30, 50][z - 1];
      const delL = (reqL + (Math.random() - 0.5) * 4).toFixed(1);
      insertCycle.run(z, plants[z - 1], reqL, 55, delL, startTime, endTime, 'completed', 'Objectif volume atteint');
    }
  }

  // Seed some alerts & logs
  insertAlert.run('system_boot', 'info', 'Système HYDRIVIA initialisé et connecté au broker MQTT.', now - 24 * 3600 * 1000, new Date(now - 24 * 3600 * 1000).toISOString());
  insertAlert.run('watering_complete', 'info', 'Cycle d\'irrigation terminé avec succès pour Zone 1 (Tomate) : 40.0 L livrés.', now - 12 * 3600 * 1000, new Date(now - 12 * 3600 * 1000).toISOString());
  insertAlert.run('water_level_normal', 'info', 'Niveau du réservoir optimal : 78% (5460 L).', now - 6 * 3600 * 1000, new Date(now - 6 * 3600 * 1000).toISOString());

  insertLog.run('CONNEXION', 'Connexion réussie au broker HiveMQ Cloud TLS', 'system', new Date(now - 24 * 3600 * 1000).toISOString());
  insertLog.run('IRRIGATION_AUTO', 'Départ irrigation programmée Zone 1 (40L, cible 55%)', 'admin@gmail.com', new Date(now - 12 * 3600 * 1000).toISOString());
  insertLog.run('SYSTEM_START', 'Démarrage du serveur Gateway HYDRIVIA', 'system', new Date(now).toISOString());

  console.log('[DB] Seeding completed.');
}

export default db;
