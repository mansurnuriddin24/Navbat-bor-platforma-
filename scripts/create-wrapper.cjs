const fs = require('fs');
const path = require('path');

const distDir = path.join(__dirname, '..', 'dist');
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

const wrapperContent = `// Auto-generated universal ESM Node runner for Render / Vercel / Cloud
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createRequire } from 'node:module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

let hasSqlite = false;
try {
  require('node:sqlite');
  hasSqlite = true;
} catch (e) {
  hasSqlite = false;
}

if (hasSqlite) {
  require('./server.cjs');
} else {
  console.log('[NavbatBor Universal Runner] Spawning Node with --experimental-sqlite flag on ' + process.version);
  const targetScript = path.join(__dirname, 'server.cjs');
  const child = spawn(process.execPath, ['--experimental-sqlite', targetScript], {
    stdio: 'inherit',
    env: process.env
  });
  child.on('exit', (code, signal) => {
    process.exit(code !== null ? code : (signal ? 1 : 0));
  });
}
`;

fs.writeFileSync(path.join(distDir, 'server.js'), wrapperContent, 'utf8');
console.log('[Build] dist/server.js universal ESM runner created successfully.');
