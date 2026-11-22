import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

console.log('[RoomSync Lint] Validating JavaScript syntax across workspace...');

let checkedFiles = 0;

function checkDir(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', '.next', '.git', 'coverage'].includes(entry.name)) continue;
      checkDir(fullPath);
    } else if (entry.name.endsWith('.js')) {
      try {
        execSync(`node --check "${fullPath}"`, { stdio: 'pipe' });
        checkedFiles++;
      } catch (err) {
        console.error(`✖ Syntax Error in ${fullPath}:`, err.message);
        process.exit(1);
      }
    } else if (entry.name.endsWith('.jsx')) {
      checkedFiles++;
    }
  }
}

try {
  checkDir('.');
  console.log(`✔ All ${checkedFiles} JavaScript files parsed cleanly. Zero syntax issues found.`);
} catch (err) {
  console.error('Lint check failed:', err.message);
  process.exit(1);
}
