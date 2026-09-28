// PM2 설정: deploy.js 가 `pm2 startOrReload deploy/ecosystem.config.cjs` 로 사용
const path = require('path');

const LOG_DIR = process.env.LOG_DIR || '/data/logs';

module.exports = {
  apps: [
    {
      name: 'projectq-api',
      cwd: path.join(__dirname, '..', 'server'),
      script: 'src/index.js',
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '500M',
      out_file: path.join(LOG_DIR, 'projectq-api.out.log'),
      error_file: path.join(LOG_DIR, 'projectq-api.err.log'),
      time: true,
      env: { NODE_ENV: 'production' },
    },
  ],
};
