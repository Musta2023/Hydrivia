import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
dotenv.config({ path: path.join(__dirname, '../../.env') });

const { Pool } = pg;
const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;

async function runPreMigration() {
  console.log('[Migration] Connecting to PostgreSQL to prepare relational tables & seed zones...');
  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });
  const client = await pool.connect();

  try {
    // 1. Create zones table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS "zones" (
        "id" INTEGER PRIMARY KEY,
        "name" TEXT NOT NULL,
        "plant" TEXT NOT NULL,
        "enabled" BOOLEAN NOT NULL DEFAULT true
      );
    `);
    console.log('[Migration] Table "zones" ensured.');

    // 2. Insert the 3 HYDRIVIA zones
    await client.query(`
      INSERT INTO "zones" ("id", "name", "plant", "enabled")
      VALUES 
        (1, 'Zone 1', 'Tomate', true),
        (2, 'Zone 2', 'Menthe', true),
        (3, 'Zone 3', 'Oignon', true)
      ON CONFLICT ("id") DO UPDATE 
      SET "name" = EXCLUDED."name", "plant" = EXCLUDED."plant", "enabled" = EXCLUDED."enabled";
    `);
    console.log('[Migration] Canonical zones (1: Tomato, 2: Mint, 3: Onion) seeded.');

    // 3. Ensure any stray zoneId in irrigation_cycles is mapped to 1, 2, or 3
    await client.query(`
      UPDATE "irrigation_cycles" SET "zone_id" = 1 WHERE "zone_id" NOT IN (1, 2, 3);
    `);

    console.log('[Migration] Pre-migration preparation complete.');
  } catch (err) {
    console.error('[Migration] Pre-migration error:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

runPreMigration().then(() => {
  console.log('[Migration] Ready for prisma db push.');
  process.exit(0);
}).catch((err) => {
  console.error('[Migration] Failed:', err);
  process.exit(1);
});
