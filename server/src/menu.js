// 상단 메뉴 구성 (관리 → 메뉴 관리) — settings.site_menu 에 JSON 으로 저장
//   [{ key: 'page:notice', visible: true }, { key: 'members', visible: true }, ...]  (순서 = 메뉴 순서)
//   key: page:<slug>(콘텐츠 페이지) / members(멤버) / shop(상점) / qna(Q&A)
// 저장 안 된 항목(새로 만든 페이지 등)은 끝에 붙고, visible 기본값은 true
const pool = require('./db');
const { getSetting, setSetting } = require('./settings');
const { HttpError } = require('./errors');

const BUILTIN = {
  members: { label: '멤버', to: '/members' },
  shop: { label: '상점', to: '/shop' },
  qna: { label: 'Q&A', to: '/qna' },
};

function parseSaved(text) {
  try {
    const list = JSON.parse(text || '[]');
    return Array.isArray(list) ? list.filter((m) => m && typeof m.key === 'string') : [];
  } catch {
    return [];
  }
}

// 전체 메뉴 후보 (저장된 순서 + 빠진 것 뒤에): [{ key, label, to, visible, isPublic? }]
async function getMenu(conn = pool) {
  const [pages] = await conn.query('SELECT slug, title, is_public FROM content_pages ORDER BY sort_order, slug');
  const items = new Map();
  for (const p of pages) items.set(`page:${p.slug}`, { key: `page:${p.slug}`, label: p.title, to: `/${p.slug}`, isPublic: !!p.is_public, page: true });
  for (const [key, b] of Object.entries(BUILTIN)) items.set(key, { key, label: b.label, to: b.to, page: false });

  const saved = parseSaved(await getSetting('site_menu', conn));
  const result = [];
  for (const s of saved) {
    const item = items.get(s.key);
    if (!item) continue;   // 지워진 페이지
    result.push({ ...item, visible: s.visible !== false });
    items.delete(s.key);
  }
  for (const item of items.values()) result.push({ ...item, visible: true });
  return result;
}

// 저장: [{ key, visible }] (순서대로) — 모르는 key 는 400
async function saveMenu(list, conn = pool) {
  if (!Array.isArray(list)) throw new HttpError(400, '메뉴 목록이 올바르지 않습니다.');
  const known = new Set((await getMenu(conn)).map((m) => m.key));
  const seen = new Set();
  const clean = [];
  for (const m of list) {
    const key = String(m?.key ?? '');
    if (!known.has(key)) throw new HttpError(400, `없는 메뉴 항목입니다: ${key}`);
    if (seen.has(key)) continue;
    seen.add(key);
    clean.push({ key, visible: m.visible !== false });
  }
  await setSetting('site_menu', JSON.stringify(clean), conn);
}

// 메뉴에서 한 항목의 표시 여부만 바꾸거나(없으면 끝에 추가) 지우기(visible = null)
// 지금 메뉴 전체(순서·표시)를 그대로 저장한 뒤 바꿈 → 저장된 메뉴가 없을 때도 새 항목이 맨 앞에 끼지 않음
async function setMenuItem(key, visible, conn = pool) {
  const list = (await getMenu(conn)).filter((m) => m.key !== key).map((m) => ({ key: m.key, visible: m.visible }));
  if (visible !== null) list.push({ key, visible });
  await setSetting('site_menu', JSON.stringify(list), conn);
}

module.exports = { BUILTIN, getMenu, saveMenu, setMenuItem };
