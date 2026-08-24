import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../backend/.env') });

const prisma = new PrismaClient();

async function verifySupabase() {
  console.log('Testing Supabase PostgreSQL connection...');
  try {
    const result = await prisma.$queryRaw`SELECT current_database(), current_user, version();`;
    console.log('Successfully connected to Supabase PostgreSQL:');
    console.log('DB Name:', result[0].current_database);
    console.log('DB User:', result[0].current_user);
    console.log('PG Version:', result[0].version.substring(0, 50));

    // Check table counts in Supabase
    const userCount = await prisma.user.count().catch(() => 'table missing');
    const sensorCount = await prisma.sensorReading.count().catch(() => 'table missing');
    const cycleCount = await prisma.irrigationCycle.count().catch(() => 'table missing');
    const alertCount = await prisma.alert.count().catch(() => 'table missing');
    const logCount = await prisma.systemLog.count().catch(() => 'table missing');
    const settingCount = await prisma.setting.count().catch(() => 'table missing');
    const aiCount = await prisma.aIAnalysis.count().catch(() => 'table missing');

    console.log('\nCurrent row counts in Supabase:');
    console.log('- users:', userCount);
    console.log('- sensor_readings:', sensorCount);
    console.log('- irrigation_cycles:', cycleCount);
    console.log('- alerts:', alertCount);
    console.log('- system_logs:', logCount);
    console.log('- settings:', settingCount);
    console.log('- ai_analyses:', aiCount);
  } catch (error) {
    console.error('Supabase connection failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

verifySupabase();
