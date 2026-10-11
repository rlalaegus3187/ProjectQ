const express = require('express');
const helmet = require('helmet');
const config = require('./config');
const pool = require('./db');
const { sessionMiddleware } = require('./session');

const app = express();

// Nginx 뒤에서 동작하므로 X-Forwarded-* 헤더를 신뢰 (secure 쿠키, 클라이언트 IP 판별에 필요)
app.set('trust proxy', 1);
app.use(helmet());
app.use(express.json({ limit: '1mb' }));   // 긴 글(콘텐츠 페이지 등) 저장용

// 로그인 세션 (채팅 서버와 같이 씀 — src/session.js)
app.use(sessionMiddleware);

// 회원 전용 모드면 로그인 안 한 요청을 막음 (로그인·가입 등 일부 제외)
app.use('/api', require('./middleware/sitePrivate'));

app.get('/api/health', async (req, res) => {
  await pool.query('SELECT 1');
  res.json({ ok: true });
});
app.use('/api/auth', require('./routes/auth'));
app.use('/api/boards', require('./routes/boards'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/uploads', require('./routes/uploads'));
app.use('/api', require('./routes/characters'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/admin', require('./routes/adminItems'));
app.use('/api/item-effects', require('./routes/itemEffects').publicRouter);
app.use('/api/admin', require('./routes/itemEffects').adminRouter);
app.use('/api/admin', require('./routes/titles').adminRouter);
app.use('/api', require('./routes/titles').memberRouter);
app.use('/api', require('./routes/chat').memberRouter);
app.use('/api/admin', require('./routes/chat').adminRouter);
app.use('/api/inventory', require('./routes/inventory'));
app.use('/api/members', require('./routes/members'));
app.use('/api/shop', require('./routes/shop'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/admin', require('./routes/adminShop'));
app.use('/api/admin', require('./routes/adminApplicants'));
app.use('/api/admin', require('./routes/adminUsers'));
app.use('/api/contents', require('./routes/contents').publicRouter);
app.use('/api/menu', require('./routes/contents').menuRouter);
app.use('/api/admin', require('./routes/contents').adminRouter);

app.use('/api', (req, res) => res.status(404).json({ message: 'Not Found' }));

app.use((err, req, res, next) => {
  // 검증 오류(HttpError), 잘못된 JSON 등 클라이언트에 보여줘도 되는 오류
  if (err.expose && err.status >= 400 && err.status < 500) {
    return res.status(err.status).json({ ...(err.data || {}), message: err.message });
  }
  if (err.name === 'MulterError') {
    const message = err.code === 'LIMIT_FILE_SIZE' ? '파일은 5MB 이하만 올릴 수 있습니다.' : '업로드 요청이 올바르지 않습니다.';
    return res.status(400).json({ message });
  }
  console.error(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`, err);   // pm2 logs <APP_NAME>-api 에서 확인
  res.status(500).json({ message: '서버 오류가 발생했습니다.' });
});

// Nginx 가 앞단에서 받으므로 외부에 직접 노출하지 않도록 로컬에만 바인딩
const server = app.listen(config.port, '127.0.0.1', () => {
  console.log(`[${config.appName}] API listening on 127.0.0.1:${config.port} (${config.env})`);
});

// 채팅 (Socket.IO, 주소 /api/socket.io) — server/src/chat/README.md
//   채팅 포트(.env CHAT_PORT)가 API 포트와 같으면 여기서 같이, 다르면 src/chatServer.js 가 따로 띄움
if (config.chatSeparate) {
  console.log(`[${config.appName}] chat → 별도 프로세스 127.0.0.1:${config.chatPort}`);
} else {
  require('./chat').setupChat(server, sessionMiddleware);
}
