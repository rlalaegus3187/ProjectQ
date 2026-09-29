// 콘텐츠 페이지 (공지 / 세계관 / 시스템 / 캐릭터 가이드)
//   공개:   GET /api/contents, GET /api/contents/:slug
//   관리자: GET /api/admin/contents, PUT /api/admin/contents/:slug
const express = require('express');
const pool = require('../db');
const requireAdmin = require('../middleware/requireAdmin');
const { HttpError } = require('../errors');
const { parseYouTubeId } = require('../youtube');

const MAX_BODY = 100000;
const COLUMNS = 'slug, title, description, body, music_video_id, sort_order, updated_at';

const toPage = (r) => ({
  slug: r.slug,
  title: r.title,
  description: r.description,
  body: r.body ?? '',
  musicVideoId: r.music_video_id,
  updatedAt: r.updated_at,
});

async function findPage(slug) {
  const [rows] = await pool.execute(`SELECT ${COLUMNS} FROM content_pages WHERE slug = ?`, [String(slug)]);
  if (!rows[0]) throw new HttpError(404, '페이지를 찾을 수 없습니다.');
  return toPage(rows[0]);
}

// 공개
const publicRouter = express.Router();
// 목록 (메뉴 이름 표시용): [{ slug, title, description }]
publicRouter.get('/', async (req, res) => {
  const [rows] = await pool.query('SELECT slug, title, description FROM content_pages ORDER BY sort_order, slug');
  res.json({ pages: rows });
});
publicRouter.get('/:slug', async (req, res) => {
  res.json({ page: await findPage(req.params.slug) });
});

// 관리자
const adminRouter = express.Router();
adminRouter.use('/contents', requireAdmin);

adminRouter.get('/contents', async (req, res) => {
  const [rows] = await pool.query(`SELECT ${COLUMNS} FROM content_pages ORDER BY sort_order, slug`);
  res.json({ pages: rows.map(toPage) });
});

// { title, description, body(마크다운), music(유튜브 링크, 비우면 없음) }
adminRouter.put('/contents/:slug', async (req, res) => {
  const title = String(req.body?.title ?? '').trim();
  if (!title || title.length > 100) throw new HttpError(400, '제목은 1~100자로 입력해주세요.');
  const description = String(req.body?.description ?? '').trim();
  if (description.length > 255) throw new HttpError(400, '설명은 255자 이내로 입력해주세요.');
  const body = String(req.body?.body ?? '');
  if (body.length > MAX_BODY) throw new HttpError(400, `내용은 ${MAX_BODY.toLocaleString()}자 이내로 입력해주세요.`);
  const musicVideoId = parseYouTubeId(req.body?.music, '페이지 음악');

  const [result] = await pool.execute(
    'UPDATE content_pages SET title = ?, description = ?, body = ?, music_video_id = ?, updated_by = ? WHERE slug = ?',
    [title, description, body, musicVideoId, req.session.userId, String(req.params.slug)],
  );
  if (!result.affectedRows) throw new HttpError(404, '페이지를 찾을 수 없습니다.');
  res.json({ page: await findPage(req.params.slug) });
});

module.exports = { publicRouter, adminRouter };
