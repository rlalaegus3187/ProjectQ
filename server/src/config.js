const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true });

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`환경변수 ${name} 가 설정되지 않았습니다 (server/.env 확인)`);
  return value;
}

module.exports = {
  env: process.env.NODE_ENV || 'development',
  // 한 서버에 사이트를 여러 개 돌릴 때 사이트마다 다르게: APP_NAME(PM2 이름·로그), SESSION_COOKIE(로그인 쿠키 이름), PORT
  appName: /^[a-z0-9][a-z0-9_-]{0,39}$/.test(process.env.APP_NAME || '') ? process.env.APP_NAME : 'projectq',
  sessionCookie: /^[A-Za-z0-9._-]{1,50}$/.test(process.env.SESSION_COOKIE || '') ? process.env.SESSION_COOKIE : 'projectq.sid',
  port: Number(process.env.PORT || 3000),
  db: {
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: required('DB_USER'),
    password: process.env.DB_PASSWORD || '',
    database: required('DB_NAME'),
  },
  sessionSecret: required('SESSION_SECRET'),
  cookieSecure: process.env.COOKIE_SECURE === 'true',
  // 회원가입 시 부여할 권한 (admin / member / applicant). 기본은 신청자
  signupRole: ['admin', 'member', 'applicant'].includes(process.env.SIGNUP_ROLE) ? process.env.SIGNUP_ROLE : 'applicant',
  // CSS 테마 폴더 (기본: 저장소의 client/public/css — 배포하면 웹 루트 /css/ 로 올라감)
  themesDir: process.env.THEMES_DIR || path.join(__dirname, '..', '..', 'client', 'public', 'css'),
  // 업로드 이미지 저장 위치 (운영: /data/uploads, 개발: server/uploads)
  uploadDir: process.env.UPLOAD_DIR
    || (process.env.NODE_ENV === 'production' ? '/data/uploads' : path.join(__dirname, '..', 'uploads')),
};
