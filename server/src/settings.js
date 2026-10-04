// 전역 설정 (settings 테이블 키-값) 읽기/쓰기
const pool = require('./db');

async function getSetting(name, conn = pool) {
  const [rows] = await conn.execute('SELECT value FROM settings WHERE name = ?', [name]);
  return rows[0]?.value ?? null;
}

// value 가 null 이면 삭제
async function setSetting(name, value, conn = pool) {
  if (value === null || value === undefined) {
    await conn.execute('DELETE FROM settings WHERE name = ?', [name]);
  } else {
    await conn.execute(
      'INSERT INTO settings (name, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value = VALUES(value)',
      [name, String(value)],
    );
  }
}

// ---------- 사이트 이름 / 파비콘 (관리 → 사이트 설정) ----------
const { HttpError } = require('./errors');

const DEFAULT_SITE_NAME = 'ProjectQ';
const FAVICON_URL_RE = /^\/api\/uploads\/[a-f0-9]{32}\.(ico|png|jpg|gif|webp)$/;

// 사이트 이름: 1~30자 (상단 로고, 브라우저 탭 제목)
function parseSiteName(value) {
  const name = String(value ?? '').trim();
  if (!name || name.length > 30) throw new HttpError(400, '사이트 이름은 1~30자로 입력해주세요.');
  return name;
}

// 파비콘(브라우저 탭 아이콘): 업로드한 이미지 경로(ico/png/...). 비우면 없음(null)
function parseFavicon(value) {
  const url = String(value ?? '').trim();
  if (!url) return null;
  if (!FAVICON_URL_RE.test(url)) throw new HttpError(400, '파비콘 이미지를 다시 업로드해주세요.');
  return url;
}

// Q&A 비회원 글쓰기 허용 여부 (settings.qna_guest_write = '1' 이면 허용, 기본은 막음)
async function isGuestWriteAllowed(conn = pool) {
  return (await getSetting('qna_guest_write', conn)) === '1';
}

// 회원 전용 모드 (settings.site_private = '1' 이면 로그인해야 사이트 이용 가능)
// 요청마다 확인하므로 짧게 캐시 (설정을 바꾸면 바로 지움)
let privateCache = null;
async function isSitePrivate(conn = pool) {
  if (privateCache && privateCache.until > Date.now()) return privateCache.value;
  const value = (await getSetting('site_private', conn)) === '1';
  privateCache = { value, until: Date.now() + 5000 };
  return value;
}
const clearSitePrivateCache = () => { privateCache = null; closedCache = null; };

// 사이트 비공개 (settings.site_closed = '1') — 관리자 말고는 로그인도, 어떤 화면도 못 봄. 문구는 site_closed_message
// 요청마다 확인하므로 짧게 캐시 (설정을 바꾸면 바로 지움)
let closedCache = null;
async function isSiteClosed(conn = pool) {
  if (closedCache && closedCache.until > Date.now()) return closedCache.value;
  const value = (await getSetting('site_closed', conn)) === '1';
  closedCache = { value, until: Date.now() + 5000 };
  return value;
}
const DEFAULT_CLOSED_MESSAGE = '홈페이지 비공개 상태입니다.';
async function getClosedMessage(conn = pool) {
  return (await getSetting('site_closed_message', conn)) || DEFAULT_CLOSED_MESSAGE;
}

// 회원가입 허용 여부 (settings.signup_open = '0' 이면 막음, 기본은 허용)
async function isSignupOpen(conn = pool) {
  return (await getSetting('signup_open', conn)) !== '0';
}

// 프로필 추가 / 수정 허용 (settings.profile_add_open, profile_edit_open = '0' 이면 막음, 기본 허용). 관리자는 항상 가능
async function isProfileAddOpen(conn = pool) {
  return (await getSetting('profile_add_open', conn)) !== '0';
}
async function isProfileEditOpen(conn = pool) {
  return (await getSetting('profile_edit_open', conn)) !== '0';
}

// 캐릭터 스탯 사용 (settings.stats_enabled = '0' 이면 미사용 — 입력·표시 모두 숨김, 저장된 값은 남음)
async function isStatsEnabled(conn = pool) {
  return (await getSetting('stats_enabled', conn)) !== '0';
}

// 공개 설정 (로그인 없이 GET /api/settings, 관리자 설정 화면)
async function getSiteSettings(conn = pool) {
  return {
    siteName: (await getSetting('site_name', conn)) || DEFAULT_SITE_NAME,
    siteFavicon: await getSetting('site_favicon', conn),
    siteMusic: await getSetting('site_music', conn),
    qnaGuestWrite: await isGuestWriteAllowed(conn),
    sitePrivate: await isSitePrivate(conn),
    siteClosed: await isSiteClosed(conn),
    siteClosedMessage: await getClosedMessage(conn),
    signupOpen: await isSignupOpen(conn),
    profileAddOpen: await isProfileAddOpen(conn),
    profileEditOpen: await isProfileEditOpen(conn),
    statsEnabled: await isStatsEnabled(conn),
    // 지금 적용된 CSS 테마 { id, css(덮어쓸 css 주소, basic 이면 null) }
    siteTheme: await require('./themes').getActiveTheme(conn),
  };
}

module.exports = {
  getSetting, setSetting, parseSiteName, parseFavicon, getSiteSettings, isGuestWriteAllowed, isSitePrivate, isSiteClosed, getClosedMessage, isSignupOpen, isProfileAddOpen, isProfileEditOpen, isStatsEnabled,
  clearSitePrivateCache,
  DEFAULT_SITE_NAME,
};
