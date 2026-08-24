import { Client } from 'pg';

const projectRef = 'dofpsqocufwbfosxblil';
const password = 'r4es4xFzB7NCJEv5';

// All Supabase AWS pooler regions
const regions = [
  'eu-central-1', // Frankfurt
  'eu-west-1',    // Ireland
  'eu-west-2',    // London
  'eu-west-3',    // Paris
  'eu-north-1',   // Stockholm
  'eu-central-2', // Zurich
  'us-east-1',    // N. Virginia
  'us-east-2',    // Ohio
  'us-west-1',    // N. California
  'us-west-2',    // Oregon
  'ca-central-1', // Canada
  'sa-east-1',    // Sao Paulo
  'ap-southeast-1', // Singapore
  'ap-southeast-2', // Sydney
  'ap-northeast-1', // Tokyo
  'ap-northeast-2', // Seoul
  'ap-south-1',     // Mumbai
  'me-central-1'    // UAE
];

async function testRegion(region) {
  const host = `aws-0-${region}.pooler.supabase.com`;
  const client = new Client({
    host,
    port: 6543,
    user: `postgres.${projectRef}`,
    password: password,
    database: 'postgres',
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 4000
  });

  try {
    await client.connect();
    console.log(`🎉 SUCCESS! Exact Supabase Pooler Region is: ${region} (${host})`);
    const res = await client.query('SELECT current_database(), version();');
    console.log('Connected to DB:', res.rows[0].current_database);
    await client.end();
    return host;
  } catch (err) {
    if (!err.message.includes('not found') && !err.message.includes('timeout')) {
      console.log(`Region ${region}: ${err.message}`);
    }
    try { await client.end(); } catch (e) {}
    return null;
  }
}

async function run() {
  console.log(`Scanning regions for project ${projectRef}...`);
  for (const r of regions) {
    process.stdout.write(`Testing ${r}... `);
    const host = await testRegion(r);
    if (host) {
      console.log('\nFOUND MATCHING REGION:', r);
      process.exit(0);
    } else {
      console.log('no');
    }
  }
}

run();
