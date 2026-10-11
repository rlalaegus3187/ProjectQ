// PM2 설정: deploy.js 가 `pm2 startOrReload deploy/ecosystem.config.cjs` 로 사용
// 값은 server/.env 에서 읽음
//   APP_NAME   PM2 이름 '<APP_NAME>-api' (+ '<APP_NAME>-chat'), 로그 '<APP_NAME>-*.log' (기본 projectq)
//              한 서버에 사이트를 여러 개 돌리면 사이트마다 다르게 (같으면 서로 덮어씀)
//   PORT       API 포트 (기본 3000)
//   CHAT_PORT  채팅 포트 — PORT 와 다르면 채팅을 따로 띄움(src/chatServer.js), 없거나 같으면 API 안에서 같이
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
const API_PORT = Number(envValue('PORT') || 3000);
const CHAT_PORT = Number(envValue('CHAT_PORT') || API_PORT);

// 접속자·방 정보가 프로세스 메모리에 있으므로 채팅은 1개로 (여러 개로 늘리려면 Redis 어댑터 필요)
const common = (name, script) => ({
  name,
  cwd: SERVER_DIR,
  script,
  instances: 1,
  exec_mode: 'fork',
  max_memory_restart: '500M',
  out_file: path.join(LOG_DIR, `${name}.out.log`),
  error_file: path.join(LOG_DIR, `${name}.err.log`),
  time: true,
  env: { NODE_ENV: 'production', PORT: String(API_PORT), CHAT_PORT: String(CHAT_PORT) },
});

module.exports = {
  apps: [
    common(`${APP_NAME}-api`, 'src/index.js'),
    ...(CHAT_PORT !== API_PORT ? [common(`${APP_NAME}-chat`, 'src/chatServer.js')] : []),
  ],
};
