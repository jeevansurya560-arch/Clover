import { execSync } from 'node:child_process';

console.log('====================================================');
console.log('       ROOMSYNC DOCKER SETUP & HEALTH CHECK         ');
console.log('====================================================\n');

try {
  console.log('[1/4] Checking Docker CLI & Engine connectivity...');
  execSync('docker ps', { stdio: 'pipe' });
  console.log('✔ Docker daemon is active and responding!\n');

  console.log('[2/4] Starting PostgreSQL 16 & Redis 7 containers via docker-compose...');
  execSync('docker compose up -d', { stdio: 'inherit' });
  console.log('✔ Containers started successfully.\n');

  console.log('[3/4] Waiting for PostgreSQL to be ready on port 5432...');
  let ready = false;
  for (let i = 0; i < 15; i++) {
    try {
      execSync('docker exec roomsync-postgres pg_isready -U postgres', { stdio: 'pipe' });
      ready = true;
      break;
    } catch {
      execSync('timeout /t 1 >nul 2>&1', { shell: 'cmd.exe' });
    }
  }

  if (ready) {
    console.log('✔ PostgreSQL is ready to accept connections.\n');
  }

  console.log('[4/4] Running migrations and seeding database...');
  execSync('npm run db:migrate', { stdio: 'inherit' });
  execSync('npm run db:seed', { stdio: 'inherit' });
  console.log('\n✔ Live PostgreSQL and Redis are 100% configured for RoomSync!');
} catch (err) {
  console.error('\n✖ Docker daemon is not yet running.');
  console.error('Please open Docker Desktop from your Windows Start Menu, click "Accept" on the terms dialog, and wait until Docker says "Engine running".');
  process.exit(1);
}
