import { DatabaseSync } from 'node:sqlite';
import { PrismaClient } from '@prisma/client';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.resolve(__dirname, '../backend/data/hydrivia.sqlite');
const sqlite = new DatabaseSync(dbPath, { readOnly: true });
const prisma = new PrismaClient();

async function verifyIntegrity() {
  console.log('=== VERIFYING DATA INTEGRITY: SQLITE VS SUPABASE POSTGRESQL ===\n');

  // 1. User check
  const uSqlite = sqlite.prepare('SELECT email, role FROM users LIMIT 1').get();
  const uPg = await prisma.user.findFirst();
  console.log('1. User Check:');
  console.log('   SQLite  :', uSqlite);
  console.log('   Supabase:', { email: uPg.email, role: uPg.role });
  console.log('   Match   :', uSqlite.email === uPg.email && uSqlite.role === uPg.role ? 'PASS' : 'FAIL');

  // 2. Sensor reading check (first and last)
  const firstSqlite = sqlite.prepare('SELECT id, zone1_soil, water_level, temperature FROM sensor_readings ORDER BY id ASC LIMIT 1').get();
  const lastSqlite = sqlite.prepare('SELECT id, zone1_soil, water_level, temperature FROM sensor_readings ORDER BY id DESC LIMIT 1').get();
  
  const firstPg = await prisma.sensorReading.findFirst({ orderBy: { id: 'asc' } });
  const lastPg = await prisma.sensorReading.findFirst({ orderBy: { id: 'desc' } });

  console.log('\n2. Sensor Readings (First & Last):');
  console.log('   SQLite First  :', firstSqlite);
  console.log('   Supabase First:', { id: Number(firstPg.id), zone1_soil: firstPg.zone1Soil, water_level: firstPg.waterLevel, temperature: firstPg.temperature });
  console.log('   SQLite Last   :', lastSqlite);
  console.log('   Supabase Last :', { id: Number(lastPg.id), zone1_soil: lastPg.zone1Soil, water_level: lastPg.waterLevel, temperature: lastPg.temperature });

  // 3. Irrigation cycle check
  const cycleSqlite = sqlite.prepare('SELECT id, zone_id, plant, requested_liters, delivered_liters FROM irrigation_cycles ORDER BY id ASC LIMIT 1').get();
  const cyclePg = await prisma.irrigationCycle.findFirst({ orderBy: { id: 'asc' } });
  console.log('\n3. Irrigation Cycle:');
  console.log('   SQLite  :', cycleSqlite);
  console.log('   Supabase:', { id: cyclePg.id, zone_id: cyclePg.zoneId, plant: cyclePg.plant, requested_liters: cyclePg.requestedLiters, delivered_liters: cyclePg.deliveredLiters });

  // 4. Alert check
  const alertSqlite = sqlite.prepare('SELECT id, type, severity, message FROM alerts ORDER BY id ASC LIMIT 1').get();
  const alertPg = await prisma.alert.findFirst({ orderBy: { id: 'asc' } });
  console.log('\n4. Alert:');
  console.log('   SQLite  :', alertSqlite);
  console.log('   Supabase:', { id: alertPg.id, type: alertPg.type, severity: alertPg.severity, message: alertPg.message });

  // 5. System log check
  const logSqlite = sqlite.prepare('SELECT id, event_type, description FROM system_logs ORDER BY id ASC LIMIT 1').get();
  const logPg = await prisma.systemLog.findFirst({ orderBy: { id: 'asc' } });
  console.log('\n5. System Log:');
  console.log('   SQLite  :', logSqlite);
  console.log('   Supabase:', { id: logPg.id, event_type: logPg.eventType, description: logPg.description });

  // 6. AI Analysis check
  const aiSqlite = sqlite.prepare('SELECT id, decision_status, valid_for_minutes FROM ai_analyses ORDER BY id ASC LIMIT 1').get();
  const aiPg = await prisma.aIAnalysis.findFirst({ orderBy: { id: 'asc' } });
  console.log('\n6. AI Analysis:');
  console.log('   SQLite  :', aiSqlite);
  console.log('   Supabase:', { id: aiPg.id, decision_status: aiPg.decisionStatus, valid_for_minutes: aiPg.validForMinutes });

  console.log('\nDATA INTEGRITY VERIFICATION COMPLETED.');
  await prisma.$disconnect();
}

verifyIntegrity();
