import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.resolve(__dirname, '../backend/data/hydrivia.sqlite');
console.log('Inspecting SQLite DB at:', dbPath);

try {
  const db = new DatabaseSync(dbPath, { readOnly: true });
  
  // Get all tables
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all();
  console.log('Found tables:', tables.map(t => t.name));

  for (const table of tables) {
    const tableName = table.name;
    const countResult = db.prepare(`SELECT COUNT(*) as count FROM "${tableName}"`).get();
    console.log(`\nTable: ${tableName} - Count: ${countResult.count}`);
    
    // Get table info (columns)
    const columns = db.prepare(`PRAGMA table_info("${tableName}")`).all();
    console.log(`  Columns (${columns.length}):`, columns.map(c => `${c.name} (${c.type})`).join(', '));

    // Get sample record
    const sample = db.prepare(`SELECT * FROM "${tableName}" LIMIT 2`).all();
    console.log('  Sample record:', JSON.stringify(sample[0] || null, null, 2));
  }
} catch (err) {
  console.error('Error inspecting SQLite DB:', err);
}
