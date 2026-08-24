import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function check() {
  try {
    console.log('Connecting to Supabase...');
    const users = await prisma.user.findMany();
    const sensorCount = await prisma.sensorReading.count();
    const cycleCount = await prisma.irrigationCycle.count();
    const alertCount = await prisma.alert.count();
    const logCount = await prisma.systemLog.count();
    const settingCount = await prisma.setting.count();
    const aiCount = await prisma.aIAnalysis.count();

    console.log('Supabase tables current status:');
    console.log('- users:', users.length, users.map(u => ({ id: u.id, email: u.email })));
    console.log('- sensor_readings:', sensorCount);
    console.log('- irrigation_cycles:', cycleCount);
    console.log('- alerts:', alertCount);
    console.log('- system_logs:', logCount);
    console.log('- settings:', settingCount);
    console.log('- ai_analyses:', aiCount);
  } catch (err) {
    console.error('Error querying Supabase:', err);
  } finally {
    await prisma.$disconnect();
  }
}

check();
