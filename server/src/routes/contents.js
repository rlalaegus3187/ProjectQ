// 콘텐츠 페이지 (공지 / 세계관 / 시스템 / 캐릭터 가이드)
//   공개:   GET /api/contents, GET /api/contents/:slug  (비공개 페이지는 관리자만 — 다른 사람에겐 목록에서 빠지고 404)
//   관리자: GET /api/admin/contents, PUT /api/admin/contents/:slug
const express = require('express');
const pool = require('../db');
const requireAdmin = require('../middleware/requireAdmin');
const { HttpError } = require('../errors');
const { parseYouTubeId } = require('../youtube');
const loadViewer = require('../middleware/loadViewer');

const MAX_BODY = 100000;
const COLUMNS = 'slug, title, description, body, music_video_id, is_public, sort_order, updated_at';

const toPage = (r) => ({
  slug: r.slug,
  title: r.title,
  description: r.description,
  body: r.body ?? '',
  musicVideoId: r.music_video_id,
  isPublic: !!r.is_public,
  updatedAt: r.updated_at,
});

async function findPage(slug) {
  const [rows] = await pool.execute(`SELECT ${COLUMNS} FROM content_pages WHERE slug = ?`, [String(slug)]);
  if (!rows[0]) throw new HttpError(404, '페이지를 찾을 수 없습니다.');
  return toPage(rows[0]);
}

// 공개
const publicRouter = express.Router();
publicRouter.use(loadViewer);
// 목록 (메뉴 이름 표시용): [{ slug, title, description, isPublic }] — 비공개 페이지는 관리자에게만
publicRouter.get('/', async (req, res) => {
  const [rows] = await pool.query(
    `SELECT slug, title, description, is_public FROM content_pages
      ${req.viewer?.isAdmin ? '' : 'WHERE is_public = 1'}
      ORDER BY sort_order, slug`,
  );
  res.json({ pages: rows.map((r) => ({ slug: r.slug, title: r.title, description: r.description, isPublic: !!r.is_public })) });
});
// 비공개 페이지는 관리자만 — 다른 사람에겐 없는 페이지처럼 404
publicRouter.get('/:slug', async (req, res) => {
  const page = await findPage(req.params.slug);
  if (!page.isPublic && !req.viewer?.isAdmin) throw new HttpError(404, '페이지를 찾을 수 없습니다.');
  res.json({ page });
});

// 관리자
const adminRouter = express.Router();
adminRouter.use('/contents', requireAdmin);

adminRouter.get('/contents', async (req, res) => {
  const [rows] = await pool.query(`SELECT ${COLUMNS} FROM content_pages ORDER BY sort_order, slug`);
  res.json({ pages: rows.map(toPage) });
});

// { title, description, body(마크다운), music(유튜브 링크, 비우면 없음), isPublic?(공개 여부) }
adminRouter.put('/contents/:slug', async (req, res) => {
  const title = String(req.body?.title ?? '').trim();
  if (!title || title.length > 100) throw new HttpError(400, '제목은 1~100자로 입력해주세요.');
  const description = String(req.body?.description ?? '').trim();
  if (description.length > 255) throw new HttpError(400, '설명은 255자 이내로 입력해주세요.');
  const body = String(req.body?.body ?? '');
  if (body.length > MAX_BODY) throw new HttpError(400, `내용은 ${MAX_BODY.toLocaleString()}자 이내로 입력해주세요.`);
  const musicVideoId = parseYouTubeId(req.body?.music, '페이지 음악');
  const isPublic = req.body?.isPublic === undefined ? null : (req.body.isPublic ? 1 : 0);   // 안 보내면 그대로

  const [result] = await pool.execute(
    `UPDATE content_pages SET title = ?, description = ?, body = ?, music_video_id = ?, is_public = COALESCE(?, is_public), updated_by = ?
      WHERE slug = ?`,
    [title, description, body, musicVideoId, isPublic, req.session.userId, String(req.params.slug)],
  );
  if (!result.affectedRows) throw new HttpError(404, '페이지를 찾을 수 없습니다.');
  res.json({ page: await findPage(req.params.slug) });
});

module.exports = { publicRouter, adminRouter };
