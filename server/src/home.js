// 메인페이지 모듈 — 관리 → 메인페이지 관리
//   메인페이지 설정: 어떤 모듈을 어떤 순서로 보일지 (settings.home_modules = [{ key, visible }])
//   모듈마다 관리 화면은 따로 (배너 관리, 캘린더 관리)
//
// 새 모듈 추가: 아래 MODULES 에 한 줄 + client/src/home/modules.js 에 화면 컴포넌트 한 줄
//   (모듈 데이터가 필요하면 homeData() 에 그 모듈 key 로 넣으면 GET /api/home 한 번에 같이 내려감)
const pool = require('./db');
const { getSetting, setSetting } = require('./settings');
const { HttpError } = require('./errors');

// 기본 순서 · 기본 표시 (새 모듈은 꺼진 채로 시작 → 배포해도 메인 화면이 갑자기 바뀌지 않음)
const MODULES = [
  { key: 'banner', label: '배너', description: '이미지 배너 — 누르면 지정한 주소로 이동 (여러 장이면 넘겨 보기)', visible: false },
  { key: 'welcome', label: '환영 문구', description: '사이트 이름 + 로그인/회원가입 안내', visible: true },
  { key: 'calendar', label: '캘린더', description: '주요 이벤트 달력 (‹ › 로 달 넘기기, ■ 오늘)', visible: false },
  { key: 'menu', label: '메뉴 바로가기', description: '상단 메뉴 항목을 카드로', visible: true },
];
const KNOWN = new Map(MODULES.map((m) => [m.key, m]));

// 저장된 순서·표시 + 새로 생긴 모듈은 뒤에 (기본 표시값으로)
async function getModules(conn = pool) {
  let saved = [];
  try { saved = JSON.parse((await getSetting('home_modules', conn)) || '[]'); } catch { saved = []; }
  const result = [];
  const seen = new Set();
  for (const s of Array.isArray(saved) ? saved : []) {
    const m = KNOWN.get(s?.key);
    if (!m || seen.has(m.key)) continue;
    seen.add(m.key);
    result.push({ ...m, visible: s.visible !== false });
  }
  for (const m of MODULES) if (!seen.has(m.key)) result.push({ ...m });
  return result;
}

async function saveModules(list, conn = pool) {
  if (!Array.isArray(list)) throw new HttpError(400, '모듈 목록이 올바르지 않습니다.');
  const seen = new Set();
  const clean = [];
  for (const m of list) {
    const key = String(m?.key ?? '');
    if (!KNOWN.has(key)) throw new HttpError(400, `없는 모듈입니다: ${key}`);
    if (seen.has(key)) continue;
    seen.add(key);
    clean.push({ key, visible: !!m.visible });
  }
  await setSetting('home_modules', JSON.stringify(clean), conn);
}

// ---------- 배너 ----------
const UPLOAD_URL_RE = /^\/api\/uploads\/[a-f0-9]{32}\.(png|jpg|gif|webp)$/;
const toBanner = (r) => ({ id: r.id, image: r.image, title: r.title || '', link: r.link || '', sortOrder: r.sort_order });

async function listBanners(conn = pool) {
  const [rows] = await conn.query('SELECT id, image, title, link, sort_order FROM home_banners ORDER BY sort_order, id');
  return rows.map(toBanner);
}

// 이동할 주소: 사이트 안('/notice') 또는 바깥('https://...'), 비우면 이동 없음
function parseLink(value) {
  const link = String(value ?? '').trim();
  if (!link) return null;
  if (link.length > 500) throw new HttpError(400, '주소는 500자 이내로 입력해주세요.');
  if (/^\/(?!\/)/.test(link)) return link;
  try {
    const u = new URL(link);
    if (u.protocol === 'http:' || u.protocol === 'https:') return u.toString();
  } catch {}
  throw new HttpError(400, "주소는 사이트 안 주소('/notice')나 http(s):// 로 시작하는 주소로 입력해주세요.");
}

function parseBanner(body) {
  const image = String(body?.image ?? '').trim();
  if (!UPLOAD_URL_RE.test(image)) throw new HttpError(400, '배너 이미지를 올려주세요.');
  const title = String(body?.title ?? '').trim();
  if (title.length > 100) throw new HttpError(400, '제목은 100자 이내로 입력해주세요.');
  const sortOrder = Number(body?.sortOrder ?? 0);
  if (!Number.isInteger(sortOrder) || Math.abs(sortOrder) > 100000) throw new HttpError(400, '순서는 정수로 입력해주세요.');
  return { image, title: title || null, link: parseLink(body?.link), sortOrder };
}

// ---------- 캘린더 ----------
// 메인 달력은 ‹ › 로 제한 없이 넘김 — 처음엔 저번달~다음달 이벤트를 같이 보내고, 그 밖의 달은 GET /api/home/events?month=YYYY-MM
const COLOR_RE = /^#[0-9a-fA-F]{6}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_RE = /^(\d{4})-(\d{2})$/;

// DATE 칼럼 → 'YYYY-MM-DD' (서버 시간대와 상관없이)
const ymd = (d) => (d instanceof Date
  ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  : String(d).slice(0, 10));
const toEvent = (r) => ({
  id: r.id, title: r.title, description: r.description || '', color: r.color, startDate: ymd(r.start_date), endDate: ymd(r.end_date),
});

// from ~ to 와 겹치는 이벤트 (둘 다 없으면 전부)
async function listEvents({ from = null, to = null } = {}, conn = pool) {
  const [rows] = from && to
    ? await conn.query('SELECT * FROM home_events WHERE start_date <= ? AND end_date >= ? ORDER BY start_date, end_date, id', [to, from])
    : await conn.query('SELECT * FROM home_events ORDER BY start_date DESC, id DESC');
  return rows.map(toEvent);
}

function parseEvent(body) {
  const title = String(body?.title ?? '').trim();
  if (!title || title.length > 100) throw new HttpError(400, '이벤트 이름은 1~100자로 입력해주세요.');
  const description = String(body?.description ?? '').trim();
  if (description.length > 2000) throw new HttpError(400, '설명은 2,000자 이내로 입력해주세요.');
  const color = String(body?.color ?? '#2563eb').trim();
  if (!COLOR_RE.test(color)) throw new HttpError(400, '색은 #rrggbb 형식으로 입력해주세요.');
  const startDate = String(body?.startDate ?? '');
  const endDate = String(body?.endDate || startDate);
  if (!DATE_RE.test(startDate) || Number.isNaN(Date.parse(startDate)) || !DATE_RE.test(endDate) || Number.isNaN(Date.parse(endDate))) {
    throw new HttpError(400, '기간(날짜)을 확인해주세요.');
  }
  if (endDate < startDate) throw new HttpError(400, '끝나는 날이 시작하는 날보다 앞입니다.');
  return { title, description: description || null, color: color.toLowerCase(), startDate, endDate };
}

// 'YYYY-MM' → 그 달 1일 ~ 말일
function monthRange(value) {
  const m = String(value ?? '').match(MONTH_RE);
  const y = m && Number(m[1]);
  const mo = m && Number(m[2]);
  if (!m || y < 1900 || y > 2200 || mo < 1 || mo > 12) throw new HttpError(400, '달은 YYYY-MM 형식으로 보내주세요.');
  const last = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  return { from: `${m[1]}-${m[2]}-01`, to: `${m[1]}-${m[2]}-${String(last).padStart(2, '0')}` };
}

// 오늘(한국 시간) 기준 저번달 1일 ~ 다음달 말일 — 메인 캘린더를 처음 열 때 같이 보내는 범위
function calendarRange(now = new Date()) {
  const kst = new Date(now.getTime() + 9 * 3600 * 1000);
  const y = kst.getUTCFullYear();
  const m = kst.getUTCMonth();
  const first = new Date(Date.UTC(y, m - 1, 1));
  const last = new Date(Date.UTC(y, m + 2, 0));
  const iso = (d) => d.toISOString().slice(0, 10);
  return { from: iso(first), to: iso(last), today: iso(kst) };
}

// ---------- GET /api/home: 메인에 보일 모듈 + 그 모듈 데이터 (한 번에) ----------
async function homeData() {
  const modules = (await getModules()).filter((m) => m.visible).map(({ key }) => ({ key }));
  const keys = new Set(modules.map((m) => m.key));
  const data = {};
  if (keys.has('banner')) data.banner = { banners: await listBanners() };
  if (keys.has('calendar')) {
    const range = calendarRange();
    data.calendar = { today: range.today, from: range.from, to: range.to, events: await listEvents(range) };
  }
  return { modules, data };
}

module.exports = {
  MODULES, getModules, saveModules,
  listBanners, parseBanner,
  listEvents, parseEvent, monthRange,
  homeData,
};
