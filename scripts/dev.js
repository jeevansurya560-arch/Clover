import { spawn } from 'node:child_process';

console.log('====================================================');
console.log('         ROOMSYNC UNIFIED DEV RUNNER                ');
console.log('====================================================');
console.log('Starting Fastify API (port 4000) & Next.js (port 3000)...\n');

const api = spawn('node', ['apps/api/src/server.js'], { stdio: 'inherit' });
const web = spawn('npm', ['run', 'dev', '--workspace=apps/web'], { stdio: 'inherit', shell: true });

process.on('SIGINT', () => {
  api.kill();
  web.kill();
  process.exit();
});
