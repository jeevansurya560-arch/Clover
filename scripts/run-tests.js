import { spawn } from 'node:child_process';

const testSuites = [
  { name: '1. Financial Engine Tests', file: 'tests/financial/finance.test.js' },
  { name: '2. API Integration Tests', file: 'tests/integration/api.test.js' },
  { name: '3. Security & Multi-Tenant Isolation Tests', file: 'tests/security/security.test.js' },
  { name: '4. Redis Memory Resilience & Eviction Policy Tests', file: 'tests/redis/redis-memory.test.js' },
  { name: '5. Automated Database Backup & Integrity Tests', file: 'tests/backup/backup.test.js' },
  { name: '6. Production Environment Safety & Config Tests', file: 'tests/config/env.test.js' }
];

console.log('====================================================');
console.log('    CLOVER AUTOMATED VERIFICATION TEST RUNNER       ');
console.log('====================================================\n');

async function runSuite(suite) {
  return new Promise((resolve, reject) => {
    console.log(`▶ Running: ${suite.name} (${suite.file})`);
    const proc = spawn('node', [suite.file], { stdio: 'inherit' });

    proc.on('close', (code) => {
      if (code === 0) {
        console.log(`✔ Passed: ${suite.name}\n`);
        resolve();
      } else {
        console.error(`✖ Failed: ${suite.name} (exit code: ${code})\n`);
        reject(new Error(`Test suite failed: ${suite.name}`));
      }
    });
  });
}

async function runAll() {
  let passed = 0;
  for (const suite of testSuites) {
    try {
      await runSuite(suite);
      passed++;
    } catch (err) {
      console.error(err.message);
      process.exit(1);
    }
  }

  console.log('====================================================');
  console.log(`🎉 ALL ${passed} TEST SUITES PASSED CLEANLY!`);
  console.log('====================================================');
}

runAll();
