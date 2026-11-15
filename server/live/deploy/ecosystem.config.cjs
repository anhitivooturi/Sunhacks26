const path = require('node:path');
module.exports = {
  apps: [{
    name: 'pulse-live', cwd: path.resolve(__dirname, '..'),
    script: 'src/index.js', instances: 1, exec_mode: 'fork',
    autorestart: true, restart_delay: 2000, max_memory_restart: '512M',
    kill_timeout: 30000, time: true,
    env: { NODE_ENV: 'production' },
  }],
};
