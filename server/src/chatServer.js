// 채팅 서버 (Socket.IO) 단독 실행 — 채팅 포트를 API 와 다르게 정했을 때 PM2 가 이 파일을 따로 띄움
//   node src/chatServer.js   (포트: CHAT_PORT, 로그인 세션은 API 와 같은 DB·쿠키라 그대로 공유)
// 포트가 같으면 이 파일은 쓰지 않고 API(src/index.js) 안에서 채팅이 같이 돎
const http = require('http');
const express = require('express');
const config = require('./config');
const { sessionMiddleware } = require('./session');
const { setupChat, getChat } = require('./chat');
const { internalRouter } = require('./chat/bridge');

const app = express();
app.set('trust proxy', 1);
app.use('/internal', internalRouter(getChat));   // API 서버 → 채팅 서버 (127.0.0.1 + 토큰만)
app.use((req, res) => res.status(404).json({ message: 'Not Found' }));
app.use((err, req, res, next) => {
  if (err.expose && err.status < 500) return res.status(err.status).json({ message: err.message });
  console.error(`[${new Date().toISOString()}] chat ${req.method} ${req.originalUrl}`, err);
  res.status(500).json({ message: '서버 오류가 발생했습니다.' });
});

const server = http.createServer(app);
setupChat(server, sessionMiddleware);
server.listen(config.chatPort, '127.0.0.1', () => {
  console.log(`[${config.appName}] chat listening on 127.0.0.1:${config.chatPort}`);
});
