// 배포용: 이 사이트가 쓸 포트를 JSON 한 줄로 출력 → deploy/deploy.js, deploy/setup-socketio.sh 가 읽음
//   node scripts/ports.js   →  {"apiPort":3000,"chatPort":3100,"separate":true}
// 값은 server/.env 의 PORT / CHAT_PORT
const { filePorts, resolvePorts } = require('../src/ports');

try {
  process.stdout.write(`${JSON.stringify(filePorts({ strict: true }) || resolvePorts(process.env))}\n`);
} catch (err) {
  console.error(`[ports] ${err.message}`);
  process.exit(1);
}
