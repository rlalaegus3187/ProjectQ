// 계정별 알림
const express = require('express');
const pool = require('../db');
const requireAuth = require('../middleware/requireAuth');
const { HttpError } = require('../characters');

const router = express.Router();
router.use(requireAuth);

async function unreadCount(userId) {
  const [[{ count }]] = await pool.query(
    'SELECT COUNT(*) AS count FROM notifications WHERE user_id = ? AND is_read = 0',
    [userId],
  );
  return Number(count);
}

// 최근 알림 50개 + 안 읽은 개수
router.get('/', async (req, res) => {
  const [rows] = await pool.query(
    `SELECT n.id, n.type, n.message, n.is_read, n.created_at, n.post_id, p.board
       FROM notifications n LEFT JOIN posts p ON p.id = n.post_id
      WHERE n.user_id = ? ORDER BY n.id DESC LIMIT 50`,
    [req.session.userId],
  );
  res.json({
    notifications: rows.map((r) => ({
      id: r.id,
      type: r.type,
      message: r.message,
      isRead: !!r.is_read,
      createdAt: r.created_at,
      link: r.post_id && r.board ? `/${r.board}/${r.post_id}` : null,
    })),
    unreadCount: await unreadCount(req.session.userId),
  });
});

// 메뉴 배지용
router.get('/unread-count', async (req, res) => {
  res.json({ unreadCount: await unreadCount(req.session.userId) });
});

router.post('/read-all', async (req, res) => {
  await pool.execute('UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0', [req.session.userId]);
  res.status(204).end();
});

router.post('/:id/read', async (req, res) => {
  const [result] = await pool.execute(
    'UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?',
    [Number(req.params.id), req.session.userId],
  );
  if (!result.affectedRows) throw new HttpError(404, '알림을 찾을 수 없습니다.');
  res.status(204).end();
});

module.exports = router;
