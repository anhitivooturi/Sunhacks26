import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const files = readdirSync(new URL('../test/', import.meta.url)).filter(name => name.endsWith('.test.js')).map(name => fileURLToPath(new URL(`../test/${name}`, import.meta.url)));
const result = spawnSync(process.execPath, ['--test', '--experimental-test-isolation=none', ...files], { stdio: 'inherit', env: { ...process.env, AI_OFFLINE: '1' } });
process.exitCode = result.status ?? 1;
