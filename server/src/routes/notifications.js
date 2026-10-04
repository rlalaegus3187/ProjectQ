// 계정별 알림 — 알림 / 보관함
//   GET    /api/notifications?box=inbox|archive   목록 (최근 50개) + 개수
//   POST   /api/notifications/:id/read            읽음
//   POST   /api/notifications/read-all            알림(보관 안 한 것) 모두 읽음
//   PUT    /api/notifications/:id/archive         { archived: true/false } 보관 / 보관 해제 (보관하면 읽음 처리)
//   DELETE /api/notifications/:id                 삭제 (보관한 알림은 삭제 안 됨)
//   POST   /api/notifications/delete-all          알림 모두 삭제 (보관함은 그대로)
const express = require('express');
const pool = require('../db');
const requireAuth = require('../middleware/requireAuth');
const { HttpError } = require('../errors');

const router = express.Router();
router.use(requireAuth);

// 안 읽은 알림 수 (메뉴 배지) — 보관함은 세지 않음
async function counts(userId) {
  const [[row]] = await pool.query(
    `SELECT COALESCE(SUM(is_archived = 0 AND is_read = 0), 0) AS unread,
            COALESCE(SUM(is_archived = 0), 0) AS inbox,
            COALESCE(SUM(is_archived = 1), 0) AS archived
       FROM notifications WHERE user_id = ?`,
    [userId],
  );
  return { unreadCount: Number(row.unread), inboxCount: Number(row.inbox), archivedCount: Number(row.archived) };
}

router.get('/', async (req, res) => {
  const archived = req.query.box === 'archive' ? 1 : 0;
  const [rows] = await pool.query(
    `SELECT n.id, n.type, n.message, n.is_read, n.is_archived, n.archived_at, n.created_at, n.post_id, n.link, p.board
       FROM notifications n LEFT JOIN posts p ON p.id = n.post_id
      WHERE n.user_id = ? AND n.is_archived = ?
      ORDER BY ${archived ? 'n.archived_at DESC,' : ''} n.id DESC LIMIT 50`,
    [req.session.userId, archived],
  );
  res.json({
    notifications: rows.map((r) => ({
      id: r.id,
      type: r.type,
      message: r.message,
      isRead: !!r.is_read,
      isArchived: !!r.is_archived,
      archivedAt: r.archived_at,
      createdAt: r.created_at,
      // 지정한 link 우선, 없으면 관련 게시글 주소
      link: r.link || (r.post_id && r.board ? `/${r.board}/${r.post_id}` : null),
    })),
    ...(await counts(req.session.userId)),
  });
});

// 메뉴 배지용
router.get('/unread-count', async (req, res) => {
  res.json({ unreadCount: (await counts(req.session.userId)).unreadCount });
});

router.post('/read-all', async (req, res) => {
  await pool.execute('UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0 AND is_archived = 0', [req.session.userId]);
  res.status(204).end();
});

// 알림 모두 삭제 — 보관한 알림은 남음
router.post('/delete-all', async (req, res) => {
  const [result] = await pool.execute('DELETE FROM notifications WHERE user_id = ? AND is_archived = 0', [req.session.userId]);
  res.json({ deleted: result.affectedRows, ...(await counts(req.session.userId)) });
});

const parseId = (value) => {
  if (!/^\d+$/.test(String(value))) throw new HttpError(404, '알림을 찾을 수 없습니다.');
  return Number(value);
};

router.post('/:id/read', async (req, res) => {
  const [result] = await pool.execute(
    'UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?',
    [parseId(req.params.id), req.session.userId],
  );
  if (!result.affectedRows) throw new HttpError(404, '알림을 찾을 수 없습니다.');
  res.status(204).end();
});

// 보관 / 보관 해제: { archived: true | false }
router.put('/:id/archive', async (req, res) => {
  const archived = !!req.body?.archived;
  const [result] = await pool.execute(
    `UPDATE notifications SET is_archived = ?, archived_at = ${archived ? 'NOW()' : 'NULL'}${archived ? ', is_read = 1' : ''}
      WHERE id = ? AND user_id = ?`,
    [archived ? 1 : 0, parseId(req.params.id), req.session.userId],
  );
  if (!result.affectedRows) throw new HttpError(404, '알림을 찾을 수 없습니다.');
  res.json(await counts(req.session.userId));
});

// 삭제 — 보관한 알림은 삭제할 수 없음 (보관 해제한 뒤 삭제)
router.delete('/:id', async (req, res) => {
  const id = parseId(req.params.id);
  const [rows] = await pool.execute('SELECT is_archived FROM notifications WHERE id = ? AND user_id = ?', [id, req.session.userId]);
  if (!rows[0]) throw new HttpError(404, '알림을 찾을 수 없습니다.');
  if (rows[0].is_archived) throw new HttpError(409, '보관한 알림은 삭제할 수 없습니다. 보관을 해제한 뒤 삭제해주세요.');
  await pool.execute('DELETE FROM notifications WHERE id = ? AND user_id = ?', [id, req.session.userId]);
  res.json(await counts(req.session.userId));
});

module.exports = router;
