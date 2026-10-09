// 콘텐츠 페이지 (공지 / 세계관 / 시스템 / 캐릭터 가이드 + 관리자가 추가한 페이지) — 페이지마다 본문(마크다운) 하나
//   공개:   GET /api/menu                상단 메뉴 (관리 → 메뉴 관리에서 고른 항목만, 순서대로)
//           GET /api/contents/:slug      페이지 (비공개 페이지는 관리자만, 다른 사람에겐 403)
//   관리자: GET  /api/admin/contents            페이지 목록
//           POST /api/admin/contents            새 페이지 { slug, title, showInMenu }
//           PUT  /api/admin/contents/:slug      저장 { title(메뉴 이름), isPublic, music, body }
//           DELETE /api/admin/contents/:slug    페이지 삭제
//           GET/PUT /api/admin/menu             메뉴 구성 [{ key, visible }]
const express = require('express');
const pool = require('../db');
const requireAdmin = require('../middleware/requireAdmin');
const loadViewer = require('../middleware/loadViewer');
const { HttpError } = require('../errors');
const { parseYouTubeId } = require('../youtube');
const { withTransaction } = require('../characters');
const { getMenu, saveMenu, setMenuItem } = require('../menu');

const MAX_BODY = 200000;
const SLUG_RE = /^[a-z][a-z0-9-]{1,29}$/;
// 다른 화면 주소와 겹치면 안 되는 이름
const RESERVED = new Set([
  'login', 'signup', 'mypage', 'notifications', 'inventory', 'admin', 'members', 'shop', 'qna', 'api', 'css', 'assets',
]);
const PAGE_COLUMNS = 'slug, title, body, music_video_id, is_public, sort_order, updated_at';

const toPage = (r) => ({
  slug: r.slug,
  title: r.title,
  body: r.body ?? '',
  musicVideoId: r.music_video_id,
  isPublic: !!r.is_public,
  updatedAt: r.updated_at,
});

async function findPage(slug, conn = pool) {
  const [rows] = await conn.execute(`SELECT ${PAGE_COLUMNS} FROM content_pages WHERE slug = ?`, [String(slug)]);
  if (!rows[0]) throw new HttpError(404, '페이지를 찾을 수 없습니다.');
  return toPage(rows[0]);
}

// ---------- 공개 ----------
const publicRouter = express.Router();
publicRouter.use(loadViewer);

// 페이지. 비공개 페이지는 관리자만 (메뉴에는 보일 수 있으므로 '비공개'라고 알려줌)
publicRouter.get('/:slug', async (req, res) => {
  const page = await findPage(req.params.slug);
  if (!page.isPublic && !req.viewer?.isAdmin) throw new HttpError(403, '비공개 페이지입니다.');
  res.json({ page });
});

// 상단 메뉴: 보이게 한 항목만 [{ key, label, to, isPublic? }]
const menuRouter = express.Router();
menuRouter.get('/', async (req, res) => {
  const menu = (await getMenu()).filter((m) => m.visible).map(({ key, label, to, isPublic }) => ({ key, label, to, isPublic }));
  res.json({ menu });
});

// ---------- 관리자 ----------
const adminRouter = express.Router();
adminRouter.use(['/contents', '/menu'], requireAdmin);

adminRouter.get('/contents', async (req, res) => {
  const [rows] = await pool.query(`SELECT ${PAGE_COLUMNS} FROM content_pages ORDER BY sort_order, slug`);
  res.json({ pages: rows.map(toPage) });
});

function parseTitle(value, label = '제목') {
  const title = String(value ?? '').trim();
  if (!title || title.length > 100) throw new HttpError(400, `${label}은 1~100자로 입력해주세요.`);
  return title;
}

// 새 페이지: { slug(주소), title, showInMenu }
adminRouter.post('/contents', async (req, res) => {
  const slug = String(req.body?.slug ?? '').trim().toLowerCase();
  if (!SLUG_RE.test(slug)) throw new HttpError(400, '주소는 영문 소문자로 시작하고 영문 소문자·숫자·- 로 2~30자여야 합니다.');
  if (RESERVED.has(slug)) throw new HttpError(400, `'${slug}' 는 다른 화면이 쓰는 주소라 쓸 수 없습니다.`);
  const title = parseTitle(req.body?.title);
  await withTransaction(async (conn) => {
    const [[{ maxOrder }]] = await conn.query('SELECT COALESCE(MAX(sort_order), 0) AS maxOrder FROM content_pages');
    try {
      await conn.execute(
        'INSERT INTO content_pages (slug, title, sort_order, updated_by) VALUES (?, ?, ?, ?)',
        [slug, title, Number(maxOrder) + 10, req.session.userId],
      );
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') throw new HttpError(409, `'/${slug}' 주소의 페이지가 이미 있습니다.`);
      throw err;
    }
    await setMenuItem(`page:${slug}`, req.body?.showInMenu !== false, conn);
  });
  res.status(201).json({ page: await findPage(slug) });
});

// 저장: { title(메뉴 이름), isPublic?, music, body(마크다운) }
adminRouter.put('/contents/:slug', async (req, res) => {
  const slug = String(req.params.slug);
  const title = parseTitle(req.body?.title);
  const musicVideoId = parseYouTubeId(req.body?.music, '페이지 음악');
  const isPublic = req.body?.isPublic === undefined ? null : (req.body.isPublic ? 1 : 0);   // 안 보내면 그대로
  const body = String(req.body?.body ?? '');
  if (body.length > MAX_BODY) throw new HttpError(400, `본문은 ${MAX_BODY.toLocaleString()}자 이내로 입력해주세요.`);

  const [result] = await pool.execute(
    `UPDATE content_pages SET title = ?, body = ?, music_video_id = ?, is_public = COALESCE(?, is_public), updated_by = ?
      WHERE slug = ?`,
    [title, body, musicVideoId, isPublic, req.session.userId, slug],
  );
  if (!result.affectedRows) throw new HttpError(404, '페이지를 찾을 수 없습니다.');
  res.json({ page: await findPage(slug) });
});

// 페이지 삭제 (메뉴에서도 빠짐)
adminRouter.delete('/contents/:slug', async (req, res) => {
  const slug = String(req.params.slug);
  await withTransaction(async (conn) => {
    const [result] = await conn.execute('DELETE FROM content_pages WHERE slug = ?', [slug]);
    if (!result.affectedRows) throw new HttpError(404, '페이지를 찾을 수 없습니다.');
    await setMenuItem(`page:${slug}`, null, conn);
  });
  res.status(204).end();
});

// 메뉴 구성 (전체 후보 + 표시 여부)
adminRouter.get('/menu', async (req, res) => {
  res.json({ menu: await getMenu() });
});
adminRouter.put('/menu', async (req, res) => {
  await saveMenu(req.body?.menu);
  res.json({ menu: await getMenu() });
});

module.exports = { publicRouter, menuRouter, adminRouter };
