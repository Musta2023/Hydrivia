import { DatabaseSync } from 'node:sqlite';
import { PrismaClient } from '@prisma/client';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.resolve(__dirname, '../backend/data/hydrivia.sqlite');
console.log('--- HYDRIVIA DATA MIGRATION: SQLite -> Supabase PostgreSQL ---');
console.log('Source SQLite DB:', dbPath);

const sqlite = new DatabaseSync(dbPath, { readOnly: true });
const prisma = new PrismaClient();

function parseJsonSafe(val) {
  if (!val) return null;
  if (typeof val === 'object') return val;
  try {
    return JSON.parse(val);
  } catch {
    return val;
  }
}

function parseDateSafe(val) {
  if (!val) return null;
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}

async function migrateData() {
  try {
    console.log('\n[1/7] Migrating USERS...');
    const sqliteUsers = sqlite.prepare('SELECT * FROM users').all();
    console.log(`Found ${sqliteUsers.length} users in SQLite.`);
    for (const u of sqliteUsers) {
      await prisma.user.upsert({
        where: { email: u.email },
        update: {
          id: Number(u.id),
          passwordHash: u.password_hash,
          role: u.role || 'admin',
          createdAt: parseDateSafe(u.created_at) || new Date()
        },
        create: {
          id: Number(u.id),
          email: u.email,
          passwordHash: u.password_hash,
          role: u.role || 'admin',
          createdAt: parseDateSafe(u.created_at) || new Date()
        }
      });
    }

    console.log('\n[2/7] Migrating SENSOR READINGS...');
    const sqliteReadings = sqlite.prepare('SELECT * FROM sensor_readings ORDER BY id ASC').all();
    console.log(`Found ${sqliteReadings.length} sensor readings in SQLite.`);
    
    // Clear initial seed if needed, or upsert/insert missing
    for (const r of sqliteReadings) {
      const idBigInt = BigInt(r.id);
      const existing = await prisma.sensorReading.findUnique({ where: { id: idBigInt } });
      const data = {
        id: idBigInt,
        timestamp: parseDateSafe(r.timestamp) || new Date(),
        zone1Soil: r.zone1_soil !== null ? Number(r.zone1_soil) : null,
        zone2Soil: r.zone2_soil !== null ? Number(r.zone2_soil) : null,
        zone3Soil: r.zone3_soil !== null ? Number(r.zone3_soil) : null,
        waterLevel: r.water_level !== null ? Number(r.water_level) : null,
        volumeLiters: r.volume_liters !== null ? Number(r.volume_liters) : null,
        temperature: r.temperature !== null ? Number(r.temperature) : null,
        airHumidity: r.air_humidity !== null ? Number(r.air_humidity) : null,
        pumpRunning: Boolean(r.pump_running),
        valve1: Boolean(r.valve1),
        valve2: Boolean(r.valve2),
        valve3: Boolean(r.valve3)
      };

      if (existing) {
        await prisma.sensorReading.update({
          where: { id: idBigInt },
          data
        });
      } else {
        await prisma.sensorReading.create({ data });
      }
    }

    console.log('\n[3/7] Migrating IRRIGATION CYCLES...');
    const sqliteCycles = sqlite.prepare('SELECT * FROM irrigation_cycles ORDER BY id ASC').all();
    console.log(`Found ${sqliteCycles.length} irrigation cycles in SQLite.`);
    for (const c of sqliteCycles) {
      const cycleId = Number(c.id);
      const existing = await prisma.irrigationCycle.findUnique({ where: { id: cycleId } });
      const data = {
        id: cycleId,
        zoneId: Number(c.zone_id),
        plant: c.plant,
        requestedLiters: c.requested_liters !== null ? Number(c.requested_liters) : null,
        targetSoilMoisture: c.target_soil_moisture !== null ? Number(c.target_soil_moisture) : null,
        deliveredLiters: c.delivered_liters !== null ? Number(c.delivered_liters) : null,
        startTime: parseDateSafe(c.start_time) || new Date(),
        endTime: parseDateSafe(c.end_time),
        status: c.status || 'completed',
        reason: c.reason || null
      };

      if (existing) {
        await prisma.irrigationCycle.update({
          where: { id: cycleId },
          data
        });
      } else {
        await prisma.irrigationCycle.create({ data });
      }
    }

    console.log('\n[4/7] Migrating ALERTS...');
    const sqliteAlerts = sqlite.prepare('SELECT * FROM alerts ORDER BY id ASC').all();
    console.log(`Found ${sqliteAlerts.length} alerts in SQLite.`);
    for (const a of sqliteAlerts) {
      const alertId = Number(a.id);
      const existing = await prisma.alert.findUnique({ where: { id: alertId } });
      const data = {
        id: alertId,
        type: a.type,
        severity: a.severity,
        message: a.message,
        timestampMs: a.timestamp_ms !== null ? BigInt(a.timestamp_ms) : null,
        createdAt: parseDateSafe(a.created_at) || new Date()
      };

      if (existing) {
        await prisma.alert.update({
          where: { id: alertId },
          data
        });
      } else {
        await prisma.alert.create({ data });
      }
    }

    console.log('\n[5/7] Migrating SYSTEM LOGS...');
    const sqliteLogs = sqlite.prepare('SELECT * FROM system_logs ORDER BY id ASC').all();
    console.log(`Found ${sqliteLogs.length} system logs in SQLite.`);
    for (const l of sqliteLogs) {
      const logId = Number(l.id);
      const existing = await prisma.systemLog.findUnique({ where: { id: logId } });
      const data = {
        id: logId,
        eventType: l.event_type,
        description: l.description,
        userEmail: l.user_email || null,
        createdAt: parseDateSafe(l.created_at) || new Date()
      };

      if (existing) {
        await prisma.systemLog.update({
          where: { id: logId },
          data
        });
      } else {
        await prisma.systemLog.create({ data });
      }
    }

    console.log('\n[6/7] Migrating SETTINGS...');
    const sqliteSettings = sqlite.prepare('SELECT * FROM settings').all();
    console.log(`Found ${sqliteSettings.length} settings in SQLite.`);
    for (const s of sqliteSettings) {
      await prisma.setting.upsert({
        where: { key: s.key },
        update: { value: s.value },
        create: { key: s.key, value: s.value }
      });
    }

    console.log('\n[7/7] Migrating AI ANALYSES...');
    const sqliteAnalyses = sqlite.prepare('SELECT * FROM ai_analyses ORDER BY created_at ASC').all();
    console.log(`Found ${sqliteAnalyses.length} AI analyses in SQLite.`);
    for (const ai of sqliteAnalyses) {
      const data = {
        id: ai.id,
        timestamp: parseDateSafe(ai.timestamp) || new Date(),
        decisionStatus: ai.decision_status,
        validForMinutes: Number(ai.valid_for_minutes || 60),
        confidencePct: Number(ai.confidence_pct || 85),
        nextEvaluationMinutes: Number(ai.next_evaluation_minutes || 120),
        waterBudget: parseJsonSafe(ai.water_budget),
        weatherAssessment: parseJsonSafe(ai.weather_assessment),
        zoneDecisions: parseJsonSafe(ai.zone_decisions),
        decisionSummary: ai.decision_summary,
        warnings: parseJsonSafe(ai.warnings),
        createdAt: parseDateSafe(ai.created_at) || new Date()
      };

      await prisma.aIAnalysis.upsert({
        where: { id: ai.id },
        update: data,
        create: data
      });
    }

    console.log('\n=== PHASE 7: RESETTING POSTGRESQL SEQUENCES ===');
    const seqQueries = [
      `SELECT setval(pg_get_serial_sequence('users', 'id'), coalesce(max(id), 1), max(id) IS NOT null) FROM users;`,
      `SELECT setval(pg_get_serial_sequence('sensor_readings', 'id'), coalesce(max(id), 1), max(id) IS NOT null) FROM sensor_readings;`,
      `SELECT setval(pg_get_serial_sequence('irrigation_cycles', 'id'), coalesce(max(id), 1), max(id) IS NOT null) FROM irrigation_cycles;`,
      `SELECT setval(pg_get_serial_sequence('alerts', 'id'), coalesce(max(id), 1), max(id) IS NOT null) FROM alerts;`,
      `SELECT setval(pg_get_serial_sequence('system_logs', 'id'), coalesce(max(id), 1), max(id) IS NOT null) FROM system_logs;`
    ];

    for (const query of seqQueries) {
      const res = await prisma.$queryRawUnsafe(query);
      console.log('Sequence update:', query.split('(')[1].split(')')[0], '-> result:', res);
    }

    console.log('\n=== PHASE 8: RECORD COUNT COMPARISON ===');
    const counts = {
      users: { sqlite: sqliteUsers.length, supabase: await prisma.user.count() },
      sensor_readings: { sqlite: sqliteReadings.length, supabase: await prisma.sensorReading.count() },
      irrigation_cycles: { sqlite: sqliteCycles.length, supabase: await prisma.irrigationCycle.count() },
      alerts: { sqlite: sqliteAlerts.length, supabase: await prisma.alert.count() },
      system_logs: { sqlite: sqliteLogs.length, supabase: await prisma.systemLog.count() },
      settings: { sqlite: sqliteSettings.length, supabase: await prisma.setting.count() },
      ai_analyses: { sqlite: sqliteAnalyses.length, supabase: await prisma.aIAnalysis.count() }
    };

    console.log('TABLE                    SQLITE     SUPABASE     STATUS');
    console.log('-------------------------------------------------------');
    for (const [table, val] of Object.entries(counts)) {
      const match = val.sqlite === val.supabase ? 'OK' : 'MISMATCH';
      console.log(`${table.padEnd(24)} ${String(val.sqlite).padEnd(10)} ${String(val.supabase).padEnd(12)} ${match}`);
    }

    console.log('\n=== PHASE 19: TEST NEW RECORD CREATION ===');
    const testLog = await prisma.systemLog.create({
      data: {
        eventType: 'MIGRATION_VERIFIED',
        description: 'PostgreSQL migration verified - new record inserted successfully',
        userEmail: 'system'
      }
    });
    console.log('Inserted test record in system_logs with generated ID:', testLog.id);
    
    // Clean up test log
    await prisma.systemLog.delete({ where: { id: testLog.id } });
    console.log('Cleaned up test record successfully.');

    console.log('\nData migration completed successfully!');
  } catch (error) {
    console.error('Data migration error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

migrateData();
