// 칭호(타이틀)
//   관리자: GET/POST /api/admin/titles                 목록(+가진 캐릭터 수) / 추가 { name, description, color, sortOrder }
//           PUT/DELETE /api/admin/titles/:id            수정 / 삭제 (가진 캐릭터에게서도 사라짐)
//           POST /api/admin/titles/bulk-delete          일괄 삭제 { ids }
//           GET  /api/admin/titles/:id/holders          이 칭호를 가진 캐릭터 목록
//           POST /api/admin/titles/:id/grant            부여 { characterIds, memo } → 받은 회원에게 알림
//           POST /api/admin/titles/:id/revoke           회수 { characterIds }
//   회원:   PUT  /api/characters/me/main-title          대표 칭호 { titleId | null } (가진 칭호만)
const express = require('express');
const pool = require('../db');
const requireAdmin = require('../middleware/requireAdmin');
const requireAuth = require('../middleware/requireAuth');
const { HttpError } = require('../errors');
const { withTransaction, getCharacterByUserId } = require('../characters');
const { parseIds } = require('../bulk');
const { notifyUsers } = require('../notify');
const { listTitles, findTitle, parseTitleInput, grantTitles, revokeTitles } = require('../titles');

const adminRouter = express.Router();
adminRouter.use('/titles', requireAdmin);

const sendList = async (res, status = 200) => res.status(status).json({ titles: await listTitles() });
const dupName = (err) => {
  if (err.code === 'ER_DUP_ENTRY') throw new HttpError(409, '같은 이름의 칭호가 이미 있습니다.');
  throw err;
};

adminRouter.get('/titles', (req, res) => sendList(res));

adminRouter.post('/titles', async (req, res) => {
  const d = parseTitleInput(req.body);
  await pool.execute(
    'INSERT INTO titles (name, description, color, sort_order) VALUES (?, ?, ?, ?)',
    [d.name, d.description, d.color, d.sortOrder],
  ).catch(dupName);
  await sendList(res, 201);
});

adminRouter.post('/titles/bulk-delete', async (req, res) => {
  const ids = parseIds(req.body?.ids, { label: '칭호를' });
  const [result] = await pool.query('DELETE FROM titles WHERE id IN (?)', [ids]);
  res.json({ deleted: result.affectedRows, titles: await listTitles() });
});

adminRouter.put('/titles/:id', async (req, res) => {
  const title = await findTitle(req.params.id);
  const d = parseTitleInput(req.body);
  await pool.execute(
    'UPDATE titles SET name = ?, description = ?, color = ?, sort_order = ? WHERE id = ?',
    [d.name, d.description, d.color, d.sortOrder, title.id],
  ).catch(dupName);
  await sendList(res);
});

adminRouter.delete('/titles/:id', async (req, res) => {
  const title = await findTitle(req.params.id);
  await pool.execute('DELETE FROM titles WHERE id = ?', [title.id]);   // character_titles 는 CASCADE, 대표 칭호는 SET NULL
  await sendList(res);
});

// 이 칭호를 가진 캐릭터
adminRouter.get('/titles/:id/holders', async (req, res) => {
  const title = await findTitle(req.params.id);
  const [rows] = await pool.execute(
    `SELECT c.id, c.name, u.username, ct.memo, ct.granted_at, (c.main_title_id = ct.title_id) AS is_main
       FROM character_titles ct
       JOIN characters c ON c.id = ct.character_id
       JOIN users u ON u.id = c.user_id
      WHERE ct.title_id = ? ORDER BY ct.granted_at DESC, c.name`,
    [title.id],
  );
  res.json({
    title,
    holders: rows.map((r) => ({
      id: r.id, name: r.name, username: r.username, memo: r.memo || '', grantedAt: r.granted_at, isMain: !!r.is_main,
    })),
  });
});

// 부여: 이미 가진 캐릭터는 건너뜀, 새로 받은 캐릭터의 회원에게 알림
adminRouter.post('/titles/:id/grant', async (req, res) => {
  const title = await findTitle(req.params.id);
  const characterIds = parseIds(req.body?.characterIds, { label: '캐릭터를' });
  const memo = String(req.body?.memo ?? '').trim().slice(0, 100) || null;
  const granted = await withTransaction(async (conn) => {
    const fresh = await grantTitles(conn, title.id, characterIds, { memo, actorUserId: req.session.userId });
    if (fresh.length) {
      const [owners] = await conn.query('SELECT user_id FROM characters WHERE id IN (?)', [fresh]);
      await notifyUsers(owners.map((r) => r.user_id), {
        type: 'title', message: `칭호 '${title.name}'을(를) 받았습니다.${memo ? ` (${memo})` : ''}`, link: '/mypage',
      }, conn);
    }
    return fresh.length;
  });
  res.json({ granted, skipped: characterIds.length - granted });
});

adminRouter.post('/titles/:id/revoke', async (req, res) => {
  const title = await findTitle(req.params.id);
  const characterIds = parseIds(req.body?.characterIds, { label: '캐릭터를' });
  const revoked = await withTransaction((conn) => revokeTitles(conn, title.id, characterIds));
  res.json({ revoked });
});

// ---------- 회원: 대표 칭호 ----------
const memberRouter = express.Router();
memberRouter.put('/characters/me/main-title', requireAuth, async (req, res) => {
  const [[me]] = await pool.execute('SELECT id FROM characters WHERE user_id = ?', [req.session.userId]);
  if (!me) throw new HttpError(404, '캐릭터가 없습니다.');
  const raw = req.body?.titleId;
  let titleId = null;
  if (raw !== null && raw !== undefined && raw !== '') {
    titleId = Number(raw);
    const [[own]] = await pool.execute('SELECT 1 AS ok FROM character_titles WHERE character_id = ? AND title_id = ?', [me.id, titleId || 0]);
    if (!own) throw new HttpError(400, '가지고 있는 칭호만 대표로 정할 수 있습니다.');
  }
  await pool.execute('UPDATE characters SET main_title_id = ? WHERE id = ?', [titleId, me.id]);
  res.json({ character: await getCharacterByUserId(req.session.userId) });
});

module.exports = { adminRouter, memberRouter };
