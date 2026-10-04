// 관리자: 회원 관리 — 회원 목록(아이디·소통 계정·권한·캐릭터), 비밀번호 강제 변경
const express = require('express');
const pool = require('../db');
const requireAdmin = require('../middleware/requireAdmin');
const { HttpError } = require('../errors');
const { hashPassword } = require('../password');
const { parseNewPassword, destroyUserSessions } = require('../accounts');
const { notify } = require('../notify');

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

module.exports = router;
