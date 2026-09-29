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

// ---------- 사이트 이름 / 아이콘 (관리 → 사이트 설정) ----------
const { HttpError } = require('./errors');

const DEFAULT_SITE_NAME = 'ProjectQ';
const UPLOAD_URL_RE = /^\/api\/uploads\/[a-f0-9]{32}\.(png|jpg|gif|webp)$/;

// 사이트 이름: 1~30자 (상단 로고, 브라우저 탭 제목)
function parseSiteName(value) {
  const name = String(value ?? '').trim();
  if (!name || name.length > 30) throw new HttpError(400, '사이트 이름은 1~30자로 입력해주세요.');
  return name;
}

// 사이트 아이콘: 이모지(또는 짧은 글자, 4글자 이내) 또는 업로드한 이미지 경로. 비우면 없음(null)
function parseSiteIcon(value) {
  const icon = String(value ?? '').trim();
  if (!icon) return null;
  if (UPLOAD_URL_RE.test(icon)) return icon;
  if ([...new Intl.Segmenter().segment(icon)].length > 4 || /[<>&"'\\]/.test(icon)) {
    throw new HttpError(400, '아이콘은 이모지(4글자 이내) 또는 업로드한 이미지만 쓸 수 있습니다.');
  }
  return icon;
}

// 공개 설정 (로그인 없이 GET /api/settings, 관리자 설정 화면)
async function getSiteSettings(conn = pool) {
  return {
    siteName: (await getSetting('site_name', conn)) || DEFAULT_SITE_NAME,
    siteIcon: await getSetting('site_icon', conn),
    siteMusic: await getSetting('site_music', conn),
  };
}

module.exports = {
  getSetting, setSetting, parseSiteName, parseSiteIcon, getSiteSettings, DEFAULT_SITE_NAME,
};
