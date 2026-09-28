const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true });

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`환경변수 ${name} 가 설정되지 않았습니다 (server/.env 확인)`);
  return value;
}

module.exports = {
  env: process.env.NODE_ENV || 'development',
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
  // 업로드 이미지 저장 위치 (운영: /data/uploads, 개발: server/uploads)
  uploadDir: process.env.UPLOAD_DIR
    || (process.env.NODE_ENV === 'production' ? '/data/uploads' : path.join(__dirname, '..', 'uploads')),
};
