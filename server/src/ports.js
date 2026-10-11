// 서버 포트 (API / 채팅) — server/.env 에서 정하고, 관리 화면(사이트 설정 → 서버 포트)에서는 보기만
//
//   PORT=3000        API 포트 (없으면 3000)
//   CHAT_PORT=3100   채팅 포트 (없거나 PORT 와 같으면 채팅도 API 프로세스 안에서 같은 포트로)
//
// 바꾸려면 .env(운영: /data/config/projectq.env)를 고치고 node /data/deploy.js
// → PM2 가 새 포트로 띄우고, Nginx 연결(deploy/apply-ports.sh)도 같이 맞춤
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const config = require('./config');

const ENV_FILE = path.join(__dirname, '..', '.env');

// .env 값 → { apiPort, chatPort, separate } — 잘못된 값이면 오류 (배포가 그 자리에서 멈추고 이유를 보여줌)
function checkPort(value, name) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1024 || n > 65535) throw new Error(`설정 파일(.env, 운영: /data/config/projectq.env)의 ${name}=${value} — 1024 ~ 65535 사이의 숫자여야 합니다.`);
  return n;
}
function resolvePorts(env) {
  const apiPort = checkPort(env.PORT || 3000, 'PORT');
  const chatPort = env.CHAT_PORT ? checkPort(env.CHAT_PORT, 'CHAT_PORT') : apiPort;
  return { apiPort, chatPort, separate: chatPort !== apiPort };
}

// .env 파일에 지금 적혀 있는 값 (다음 배포 때 적용될 값)
function filePorts({ strict = false } = {}) {
  let text;
  try {
    text = fs.readFileSync(ENV_FILE);
  } catch {
    return null;
  }
  try {
    return resolvePorts(dotenv.parse(text));
  } catch (err) {
    if (strict) throw err;   // 배포: 멈춤 / 관리 화면: 안 보임
    return null;
  }
}

// 지금 실제로 쓰는 포트 (PM2 가 띄운 값)
const runningPorts = () => ({ apiPort: config.port, chatPort: config.chatPort, separate: config.chatSeparate });

// 관리 화면용 (보기 전용)
function portStatus() {
  const running = runningPorts();
  const file = filePorts();
  return {
    running,
    file,   // .env 에 적힌 값
    pending: !!file && (file.apiPort !== running.apiPort || file.chatPort !== running.chatPort),
  };
}

module.exports = { ENV_FILE, resolvePorts, filePorts, runningPorts, portStatus };
