const express = require('express');
const session = require('express-session');
const helmet = require('helmet');
const MySQLStore = require('express-mysql-session')(session);
const config = require('./config');
const pool = require('./db');

const app = express();

// Nginx 뒤에서 동작하므로 X-Forwarded-* 헤더를 신뢰 (secure 쿠키, 클라이언트 IP 판별에 필요)
app.set('trust proxy', 1);
app.use(helmet());
app.use(express.json({ limit: '100kb' }));

// 세션은 MySQL(sessions 테이블)에 저장 → PM2 재시작/재배포해도 로그인 유지
const sessionStore = new MySQLStore({ createDatabaseTable: false }, pool);

app.use(session({
  name: 'projectq.sid',
  secret: config.sessionSecret,
  store: sessionStore,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,               // JS 에서 접근 불가 (XSS 로 탈취 방지)
    secure: config.cookieSecure,  // HTTPS 에서만 전송
    sameSite: 'lax',              // 다른 사이트에서의 POST 에 쿠키 미전송 (CSRF 완화)
    maxAge: 1000 * 60 * 60 * 24 * 7,
  },
}));

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
app.use('/api/inventory', require('./routes/inventory'));
app.use('/api/members', require('./routes/members'));

app.use('/api', (req, res) => res.status(404).json({ message: 'Not Found' }));

app.use((err, req, res, next) => {
  // 검증 오류(HttpError), 잘못된 JSON 등 클라이언트에 보여줘도 되는 오류
  if (err.expose && err.status >= 400 && err.status < 500) {
    return res.status(err.status).json({ message: err.message });
  }
  if (err.name === 'MulterError') {
    const message = err.code === 'LIMIT_FILE_SIZE' ? '파일은 5MB 이하만 올릴 수 있습니다.' : '업로드 요청이 올바르지 않습니다.';
    return res.status(400).json({ message });
  }
  console.error(err);
  res.status(500).json({ message: '서버 오류가 발생했습니다.' });
});

// Nginx 가 앞단에서 받으므로 외부에 직접 노출하지 않도록 로컬에만 바인딩
app.listen(config.port, '127.0.0.1', () => {
  console.log(`[projectq] API listening on 127.0.0.1:${config.port} (${config.env})`);
});
