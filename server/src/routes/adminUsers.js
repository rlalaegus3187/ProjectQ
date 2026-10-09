// 관리자: 회원 관리 — 회원 목록(아이디·소통 계정·권한·캐릭터), 비밀번호 강제 변경, 권한 변경·회원 삭제(체크해서 일괄)
const express = require('express');
const pool = require('../db');
const requireAdmin = require('../middleware/requireAdmin');
const { HttpError } = require('../errors');
const { hashPassword } = require('../password');
const { parseNewPassword, destroyUserSessions, detachUserPosts } = require('../accounts');
const { notify, notifyUsers } = require('../notify');
const { withTransaction } = require('../characters');
const { parseIds } = require('../bulk');
const ROLE_LABELS = { admin: '관리자', member: '멤버', applicant: '신청자' };

const router = express.Router();
router.use('/users', requireAdmin);

const PAGE_SIZE = 50;
const ROLES = ['admin', 'member', 'applicant'];

// 목록: ?q= 아이디/소통 계정/캐릭터 이름, ?role=admin|member|applicant, ?page=
router.get('/users', async (req, res) => {
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const q = String(req.query.q ?? '').trim();
  const conditions = [];
  const params = [];
  if (ROLES.includes(req.query.role)) { conditions.push('u.role = ?'); params.push(req.query.role); }
  if (q) { conditions.push('(u.username LIKE ? OR u.contact LIKE ? OR c.name LIKE ?)'); params.push(`%${q}%`, `%${q}%`, `%${q}%`); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const [[{ total }]] = await pool.query(
    `SELECT COUNT(*) AS total FROM users u LEFT JOIN characters c ON c.user_id = u.id ${where}`,
    params,
  );
  const [rows] = await pool.query(
    `SELECT u.id, u.username, u.contact, u.role, u.created_at, u.last_login_at, c.id AS character_id, c.name AS character_name
       FROM users u LEFT JOIN characters c ON c.user_id = u.id
      ${where}
      ORDER BY u.id DESC LIMIT ? OFFSET ?`,
    [...params, PAGE_SIZE, (page - 1) * PAGE_SIZE],
  );
  res.json({
    users: rows.map((r) => ({
      id: r.id,
      username: r.username,
      contact: r.contact,
      role: r.role,
      character: r.character_id ? { id: r.character_id, name: r.character_name } : null,
      createdAt: r.created_at,
      lastLoginAt: r.last_login_at,
    })),
    page,
    pageSize: PAGE_SIZE,
    total: Number(total),
  });
});

// 비밀번호 강제 변경: { newPassword } → 그 회원의 로그인은 모두 끊김 (새 비밀번호로 다시 로그인)
router.put('/users/:id/password', async (req, res) => {
  if (!/^\d+$/.test(req.params.id)) throw new HttpError(404, '회원을 찾을 수 없습니다.');
  const userId = Number(req.params.id);
  const newPassword = parseNewPassword(req.body?.newPassword, '새 비밀번호');
  const [result] = await pool.execute('UPDATE users SET password_hash = ? WHERE id = ?', [await hashPassword(newPassword), userId]);
  if (!result.affectedRows) throw new HttpError(404, '회원을 찾을 수 없습니다.');
  // 관리자 본인 비밀번호를 여기서 바꾸면 지금 세션은 유지
  await destroyUserSessions(userId, userId === req.session.userId ? req.sessionID : null);
  await notify({ userId, type: 'password_reset', message: '관리자가 비밀번호를 변경했습니다. 새 비밀번호로 로그인해주세요.', link: '/mypage' });
  res.status(204).end();
});

// 일괄 처리 대상 검사: 내 계정은 여기서 바꾸거나 지울 수 없음, 관리자가 한 명은 남아야 함
async function checkTargets(conn, req, ids, { removesAdmin }) {
  if (ids.includes(req.session.userId)) {
    throw new HttpError(400, '내 계정은 여기서 바꾸거나 삭제할 수 없습니다. (내 계정 삭제는 마이페이지에서)');
  }
  const [rows] = await conn.query('SELECT id, username, role FROM users WHERE id IN (?) FOR UPDATE', [ids]);
  if (rows.length !== ids.length) throw new HttpError(404, '없는 회원이 포함되어 있습니다. 새로고침 후 다시 시도해주세요.');
  if (removesAdmin && rows.some((r) => r.role === 'admin')) {
    const [[{ left }]] = await conn.query("SELECT COUNT(*) AS `left` FROM users WHERE role = 'admin' AND id NOT IN (?)", [ids]);
    if (Number(left) < 1) throw new HttpError(400, '관리자가 한 명도 남지 않게 됩니다.');
  }
  return rows;
}

// 권한 일괄 변경: { ids, role: admin|member|applicant } → 바뀐 회원에게 알림
router.patch('/users/role', async (req, res) => {
  const ids = parseIds(req.body?.ids, { label: '회원을' });
  const role = req.body?.role;
  if (!ROLES.includes(role)) throw new HttpError(400, '권한은 admin, member, applicant 중 하나여야 합니다.');
  const changed = await withTransaction(async (conn) => {
    const rows = await checkTargets(conn, req, ids, { removesAdmin: role !== 'admin' });
    const targets = rows.filter((r) => r.role !== role);
    if (!targets.length) return [];
    await conn.query('UPDATE users SET role = ? WHERE id IN (?)', [role, targets.map((r) => r.id)]);
    // 멤버·관리자가 되면 신청서는 더 이상 잠기지 않도록 (신청 상태 정리)
    if (role !== 'applicant') {
      await conn.query("UPDATE characters SET application_status = 'submitted' WHERE user_id IN (?)", [targets.map((r) => r.id)]);
    }
    await notifyUsers(targets.map((r) => r.id), {
      type: 'role_changed', message: `권한이 '${ROLE_LABELS[role]}'(으)로 변경되었습니다.`, link: '/mypage',
    }, conn);
    return targets;
  });
  res.json({ updated: changed.length, skipped: ids.length - changed.length });
});

// 회원 일괄 삭제: { ids } — 캐릭터·프로필·인벤토리·기록·알림도 함께 삭제 (DB FK CASCADE), 로그인도 끊음
// Q&A 글·답변은 계정과 연결하지 않으므로 그대로 남음 (탈퇴한 회원의 글)
router.post('/users/bulk-delete', async (req, res) => {
  const ids = parseIds(req.body?.ids, { label: '회원을' });
  const deleted = await withTransaction(async (conn) => {
    const rows = await checkTargets(conn, req, ids, { removesAdmin: true });
    await detachUserPosts(conn, ids);
    await conn.query('DELETE FROM users WHERE id IN (?)', [ids]);
    return rows;
  });
  for (const r of deleted) await destroyUserSessions(r.id);
  res.json({ deleted: deleted.length, usernames: deleted.map((r) => r.username) });
});

module.exports = router;
