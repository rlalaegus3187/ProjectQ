// 로그인 세션 (express-session + MySQL sessions 테이블) — API 서버와 채팅 서버(chatServer.js)가 같이 씀
// 둘이 다른 프로세스여도 같은 DB·같은 쿠키 이름·같은 비밀값이라 로그인이 공유됨
const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);
const config = require('./config');
const pool = require('./db');

// 세션은 MySQL(sessions 테이블)에 저장 → PM2 재시작/재배포해도 로그인 유지
const sessionStore = new MySQLStore({ createDatabaseTable: false }, pool);

const sessionMiddleware = session({
  name: config.sessionCookie,   // 사이트마다 다르게 (server/.env SESSION_COOKIE)
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
});

module.exports = { sessionMiddleware, sessionStore };
