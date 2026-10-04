// 사이트 출입 제한 (관리 → 사이트 설정 → 사이트 공개 · 회원가입)
//
// ① 사이트 비공개 (settings.site_closed = '1'): 관리자만 사이트를 쓸 수 있음
//    관리자가 아니면(로그인 안 함 포함) 아래 CLOSED_OPEN 말고 전부 403 { siteClosed: true, message: 관리자가 정한 문구 }
//    로그인도 관리자만 됨 (routes/auth.js)
// ② 회원 전용 (settings.site_private = '1'): 로그인하지 않은 요청은 PUBLIC 말고 전부 401
// → 화면만 막는 게 아니라 API 데이터(멤버, 페이지 내용, 게시판 ...)도 막음
const pool = require('../db');
const { isSitePrivate, isSiteClosed, getClosedMessage } = require('../settings');

// 로그인 전에도 필요한 API (/api 아래 경로): 로그인/회원가입, 사이트 이름·파비콘, 회원가입 폼 항목, 이미지 업로드·보기(가입 폼·파비콘)
const PUBLIC = [
  { method: 'ANY', prefix: '/auth/' },
  { method: 'GET', prefix: '/settings' },
  { method: 'GET', prefix: '/attributes' },
  { method: 'ANY', prefix: '/uploads' },
  { method: 'GET', prefix: '/health' },
];
// 사이트 비공개 중에도 열어두는 것: 관리자 로그인, 로그아웃, 내 정보, 사이트 이름·문구, 파비콘 보기
const CLOSED_OPEN = [
  { method: 'POST', prefix: '/auth/login' },
  { method: 'POST', prefix: '/auth/logout' },
  { method: 'GET', prefix: '/auth/me' },
  { method: 'GET', prefix: '/settings' },
  { method: 'GET', prefix: '/uploads/' },
  { method: 'GET', prefix: '/health' },
];

const matches = (list, req) => list.some(({ method, prefix }) => (method === 'ANY' || req.method === method) && req.path.startsWith(prefix));

async function isAdminSession(req) {
  if (!req.session.userId) return false;
  const [rows] = await pool.execute('SELECT role FROM users WHERE id = ?', [req.session.userId]);
  return rows[0]?.role === 'admin';
}

module.exports = async function sitePrivate(req, res, next) {
  if (await isSiteClosed() && !matches(CLOSED_OPEN, req) && !(await isAdminSession(req))) {
    return res.status(403).json({ message: await getClosedMessage(), siteClosed: true });
  }
  if (req.session.userId || matches(PUBLIC, req)) return next();
  if (await isSitePrivate()) {
    return res.status(401).json({ message: '회원 전용 사이트입니다. 로그인해주세요.', sitePrivate: true });
  }
  next();
};
