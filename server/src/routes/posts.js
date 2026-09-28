// 로그인한 사용자만 쓸 수 있는 샘플 API (간단한 메모 게시판)
const express = require('express');
const pool = require('../db');
const requireAuth = require('../middleware/requireAuth');

const router = express.Router();

router.get('/', async (req, res) => {
  const [rows] = await pool.query(
    `SELECT p.id, p.title, p.body, p.created_at AS createdAt, u.name AS author
       FROM posts p JOIN users u ON u.id = p.user_id
      ORDER BY p.id DESC LIMIT 50`,
  );
  res.json({ posts: rows });
});

router.post('/', requireAuth, async (req, res) => {
  const title = String(req.body?.title || '').trim();
  const body = String(req.body?.body || '').trim();
  if (!title || title.length > 200) return res.status(400).json({ message: '제목은 1~200자로 입력해주세요.' });

  const [result] = await pool.execute(
    'INSERT INTO posts (user_id, title, body) VALUES (?, ?, ?)',
    [req.session.userId, title, body],
  );
  res.status(201).json({ id: result.insertId });
});

module.exports = router;
