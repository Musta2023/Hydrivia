import net from 'net';

const host = 'db.dofpsqocufwbfosxblil.supabase.co';
const port = 5432;

console.log(`Testing TCP connection to ${host}:${port}...`);

const socket = net.createConnection({ host, port, timeout: 5000 }, () => {
  console.log('✓ TCP Connection successful to Supabase PostgreSQL port 5432!');
  socket.end();
});

socket.on('error', (err) => {
  console.error('❌ Connection failed:', err.message);
});

socket.on('timeout', () => {
  console.error('❌ Connection timed out!');
  socket.destroy();
});
