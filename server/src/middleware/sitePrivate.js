// 회원 전용 모드 (관리 → 사이트 설정 → 사이트 공개 상태)
// settings.site_private = '1' 이면 로그인하지 않은 요청은 아래 허용 목록 말고 전부 401
// → 화면만 막는 게 아니라 API 데이터(멤버, 페이지 내용, 게시판 ...)도 로그인해야 받을 수 있음
const { isSitePrivate } = require('../settings');

// 로그인 전에도 필요한 API (/api 아래 경로): 로그인/회원가입, 사이트 이름·파비콘, 회원가입 폼 항목, 이미지 업로드·보기(가입 폼·파비콘)
const PUBLIC = [
  { method: 'ANY', prefix: '/auth/' },
  { method: 'GET', prefix: '/settings' },
  { method: 'GET', prefix: '/attributes' },
  { method: 'ANY', prefix: '/uploads' },
  { method: 'GET', prefix: '/health' },
];

const isPublic = (req) => PUBLIC.some(({ method, prefix }) => (method === 'ANY' || req.method === method) && req.path.startsWith(prefix));

module.exports = async function sitePrivate(req, res, next) {
  if (req.session.userId || isPublic(req)) return next();
  if (await isSitePrivate()) {
    return res.status(401).json({ message: '회원 전용 사이트입니다. 로그인해주세요.', sitePrivate: true });
  }
  next();
};
