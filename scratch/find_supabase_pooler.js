import net from 'net';

const projectRef = 'dofpsqocufwbfosxblil';
const regions = [
  'eu-west-1', 'eu-west-2', 'eu-west-3', 'eu-central-1', 'eu-central-2', 'eu-north-1',
  'us-east-1', 'us-east-2', 'us-west-1', 'us-west-2',
  'ap-southeast-1', 'ap-southeast-2', 'ap-south-1', 'ap-northeast-1', 'ap-northeast-2',
  'sa-east-1', 'ca-central-1'
];

async function checkHost(host, port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port, timeout: 3000 }, () => {
      socket.end();
      resolve(true);
    });
    socket.on('error', () => resolve(false));
    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });
  });
}

async function findRegion() {
  console.log('Testing Supabase REST HTTPS...');
  try {
    const res = await fetch(`https://${projectRef}.supabase.co/rest/v1/`);
    console.log(`✓ HTTPS REST connected! Status: ${res.status}`);
  } catch (e) {
    console.log('REST error:', e.message);
  }

  console.log('\nTesting Supabase Pooler regions for IPv4...');
  for (const r of regions) {
    const host = `aws-0-${r}.pooler.supabase.com`;
    const ok = await checkHost(host, 6543);
    if (ok) {
      console.log(`🎉 Found active pooler region: ${host} (port 6543 / 5432)`);
      return host;
    }
  }
  console.log('No pooler found on tested regions.');
}

findRegion();
