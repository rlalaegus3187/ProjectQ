// PM2 설정: deploy.js 가 `pm2 startOrReload deploy/ecosystem.config.cjs` 로 사용
// 앱 이름은 server/.env 의 APP_NAME (기본 projectq) → PM2 이름 '<APP_NAME>-api', 로그 '<APP_NAME>-api.*.log'
//   한 서버에 사이트를 여러 개 돌리면 사이트마다 APP_NAME 을 다르게 (같으면 서로 덮어씀)
const fs = require('fs');
const path = require('path');

const LOG_DIR = process.env.LOG_DIR || '/data/logs';
const SERVER_DIR = path.join(__dirname, '..', 'server');

function envValue(name) {
  try {
    const m = fs.readFileSync(path.join(SERVER_DIR, '.env'), 'utf8').match(new RegExp(`^${name}=(.*)$`, 'm'));
    return m ? m[1].trim().replace(/^["']|["']$/g, '') : '';
  } catch {
    return '';
  }
}
const APP_NAME = /^[a-z0-9][a-z0-9_-]{0,39}$/.test(envValue('APP_NAME')) ? envValue('APP_NAME') : 'projectq';

module.exports = {
  apps: [
    {
      name: `${APP_NAME}-api`,
      cwd: SERVER_DIR,
      script: 'src/index.js',
      // 채팅(Socket.IO)의 접속자·방 정보가 프로세스 메모리에 있으므로 1개로 (여러 개로 늘리려면 Redis 어댑터 필요)
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '500M',
      out_file: path.join(LOG_DIR, `${APP_NAME}-api.out.log`),
      error_file: path.join(LOG_DIR, `${APP_NAME}-api.err.log`),
      time: true,
      env: { NODE_ENV: 'production' },
    },
  ],
};
