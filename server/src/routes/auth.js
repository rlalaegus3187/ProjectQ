const express = require('express');
const rateLimit = require('express-rate-limit');
const pool = require('../db');
const { hashPassword, verifyPassword } = require('../password');
const requireAuth = require('../middleware/requireAuth');
const config = require('../config');
const { HttpError } = require('../errors');
const {
  getSetting, isSignupOpen, isSiteClosed, getClosedMessage,
} = require('../settings');
const {
  parseUsername, parseNewPassword, parseContact, destroyUserSessions, detachUserPosts,
} = require('../accounts');
const { withTransaction } = require('../characters');

const router = express.Router();

// 로그인/회원가입 무차별 대입 방지: IP 당 15분에 20회
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { message: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' },
});

const USER_COLUMNS = 'id, username, contact, agreed_at, role, music_volume, music_enabled, created_at';

function toPublicUser(row) {
  return {
    id: row.id,
    username: row.username,   // 로그인 아이디 (화면 표시 이름으로도 사용)
    contact: row.contact,     // 소통 계정
    agreedAt: row.agreed_at,  // 회원가입 안내(약관) 동의 시각 (null = 기록 없음)
    role: row.role,
    // 계정별 음악 설정 (음악 모듈이 사용)
    musicVolume: row.music_volume,
    musicEnabled: !!row.music_enabled,
    createdAt: row.created_at,
  };
}

const findUser = async (id) => (await pool.execute(`SELECT ${USER_COLUMNS} FROM users WHERE id = ?`, [id]))[0][0];

// 세션 고정(session fixation) 공격 방지를 위해 로그인 시 세션 ID 를 새로 발급
function startSession(req, userId) {
  return new Promise((resolve, reject) => {
    req.session.regenerate((err) => {
      if (err) return reject(err);
      req.session.userId = userId;
      req.session.save((saveErr) => (saveErr ? reject(saveErr) : resolve()));
    });
  });
}

// 회원가입 안내(주의문구) — 관리 → 사이트 설정에서 작성 (마크다운). 회원 전용 모드에서도 로그인 없이 조회
// open: 회원가입 허용 여부 (관리 → 사이트 설정)
router.get('/signup-info', async (req, res) => {
  const open = await isSignupOpen();
  res.json({ open, notice: open ? (await getSetting('signup_notice')) || '' : '' });
});

// 회원가입: { username, password, contact, agree: true } — 캐릭터는 가입 후 마이페이지에서 작성
router.post('/signup', authLimiter, async (req, res) => {
  if (!(await isSignupOpen())) throw new HttpError(403, '지금은 회원가입을 받지 않습니다.');
  if (req.body?.agree !== true) throw new HttpError(400, '가입 안내에 동의해야 가입할 수 있습니다.');
  const username = parseUsername(req.body?.username);
  const password = parseNewPassword(req.body?.password);
  const contact = parseContact(req.body?.contact);
  const passwordHash = await hashPassword(password);
  // 동의한 그때의 안내 내용을 함께 저장 (나중에 마이페이지에서 다시 보기)
  const notice = (await getSetting('signup_notice')) || '';

  let userId;
  try {
    const [result] = await pool.execute(
      'INSERT INTO users (username, contact, agreed_at, agreed_notice, role, password_hash) VALUES (?, ?, NOW(), ?, ?, ?)',
      [username, contact, notice, config.signupRole, passwordHash],
    );
    userId = result.insertId;
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') throw new HttpError(409, '이미 사용 중인 아이디입니다.');
    throw err;
  }

  await startSession(req, userId);
  res.status(201).json({ user: toPublicUser(await findUser(userId)) });
});

router.post('/login', authLimiter, async (req, res) => {
  const username = String(req.body?.username || '').trim();
  const password = String(req.body?.password || '');

  const [rows] = await pool.execute(
    `SELECT ${USER_COLUMNS}, password_hash FROM users WHERE username = ?`,
    [username],
  );
  const user = rows[0];
  // 아이디 존재 여부를 노출하지 않도록 같은 메시지 사용
  if (!user || !(await verifyPassword(password, user.password_hash))) {
    return res.status(401).json({ message: '아이디 또는 비밀번호가 올바르지 않습니다.' });
  }

  // 사이트 비공개 중에는 관리자만 로그인 (비밀번호가 맞아도 다른 회원은 안내 문구)
  if (user.role !== 'admin' && await isSiteClosed()) {
    return res.status(403).json({ message: await getClosedMessage(), siteClosed: true });
  }

  await startSession(req, user.id);
  await pool.execute('UPDATE users SET last_login_at = NOW() WHERE id = ?', [user.id]);
  res.json({ user: toPublicUser(user) });
});

router.post('/logout', (req, res, next) => {
  req.session.destroy((err) => {
    if (err) return next(err);
    res.clearCookie('projectq.sid');
    res.status(204).end();
  });
});

router.get('/me', requireAuth, async (req, res) => {
  const user = await findUser(req.session.userId);
  if (!user) {
    req.session.destroy(() => {});
    return res.status(401).json({ message: '로그인이 필요합니다.' });
  }
  res.json({ user: toPublicUser(user) });
});

// 내 정보 수정: { contact } (아이디는 바꿀 수 없음)
router.put('/me', requireAuth, async (req, res) => {
  const contact = parseContact(req.body?.contact);
  await pool.execute('UPDATE users SET contact = ? WHERE id = ?', [contact, req.session.userId]);
  res.json({ user: toPublicUser(await findUser(req.session.userId)) });
});

// 회원가입 안내(약관) → { agreedAt(동의한 시각, 없으면 null), notice(지금 안내 — 관리자가 고치면 고친 내용) }
// 동의 기록이 없으면(이 기능 전 가입) 마이페이지에서 동의할 수 있게
// (가입 때의 내용은 users.agreed_notice 에 기록으로만 남겨둠)
router.get('/me/agreement', requireAuth, async (req, res) => {
  const [rows] = await pool.execute('SELECT agreed_at FROM users WHERE id = ?', [req.session.userId]);
  res.json({ agreedAt: rows[0]?.agreed_at ?? null, notice: (await getSetting('signup_notice')) || '' });
});

// 지금 안내에 동의 (동의 기록이 없는 회원) { agree: true }
router.put('/me/agreement', requireAuth, async (req, res) => {
  if (req.body?.agree !== true) throw new HttpError(400, '안내에 동의해주세요.');
  const notice = (await getSetting('signup_notice')) || '';
  await pool.execute(
    'UPDATE users SET agreed_at = NOW(), agreed_notice = ? WHERE id = ? AND agreed_at IS NULL',
    [notice, req.session.userId],
  );
  res.json({ user: toPublicUser(await findUser(req.session.userId)) });
});

// 계정 삭제 (되돌릴 수 없음): { password, confirm: true }
// 함께 삭제(FK CASCADE): 캐릭터(프로필·스탯·인벤토리·아이템/소지금 기록), 알림
// 내가 쓴 Q&A 글은 남음 (계정과 연결하지 않음 — '탈퇴한 회원'의 글로 표시)
router.delete('/me', authLimiter, requireAuth, async (req, res) => {
  if (req.body?.confirm !== true) throw new HttpError(400, '복구할 수 없다는 안내에 동의해주세요.');
  const userId = req.session.userId;
  const [rows] = await pool.execute('SELECT role, password_hash FROM users WHERE id = ?', [userId]);
  if (!rows[0] || !(await verifyPassword(String(req.body?.password ?? ''), rows[0].password_hash))) {
    throw new HttpError(400, '비밀번호가 올바르지 않습니다.');
  }
  // 관리자가 한 명도 남지 않으면 사이트를 관리할 수 없으므로 막음
  if (rows[0].role === 'admin') {
    const [[{ admins }]] = await pool.query("SELECT COUNT(*) AS admins FROM users WHERE role = 'admin'");
    if (Number(admins) <= 1) throw new HttpError(400, '마지막 관리자 계정은 삭제할 수 없습니다. 다른 관리자를 먼저 지정해주세요.');
  }
  await withTransaction(async (conn) => {
    await detachUserPosts(conn, [userId]);
    await conn.execute('DELETE FROM users WHERE id = ?', [userId]);
  });
  await destroyUserSessions(userId);   // 다른 기기의 로그인도 끊음
  req.session.destroy(() => {
    res.clearCookie('projectq.sid');
    res.status(204).end();
  });
});

// 비밀번호 변경: { currentPassword, newPassword } → 다른 기기의 로그인은 끊김
router.put('/me/password', authLimiter, requireAuth, async (req, res) => {
  const [rows] = await pool.execute('SELECT password_hash FROM users WHERE id = ?', [req.session.userId]);
  if (!rows[0] || !(await verifyPassword(String(req.body?.currentPassword ?? ''), rows[0].password_hash))) {
    throw new HttpError(400, '현재 비밀번호가 올바르지 않습니다.');
  }
  const newPassword = parseNewPassword(req.body?.newPassword, '새 비밀번호');
  await pool.execute('UPDATE users SET password_hash = ? WHERE id = ?', [await hashPassword(newPassword), req.session.userId]);
  await destroyUserSessions(req.session.userId, req.sessionID);
  res.status(204).end();
});

// 계정별 음악 설정 저장: { musicVolume?: 0~100, musicEnabled?: boolean }
router.put('/me/preferences', requireAuth, async (req, res) => {
  const updates = [];
  const params = [];
  if (req.body?.musicVolume !== undefined) {
    const v = Number(req.body.musicVolume);
    if (!Number.isInteger(v) || v < 0 || v > 100) return res.status(400).json({ message: '볼륨은 0~100 사이의 정수여야 합니다.' });
    updates.push('music_volume = ?'); params.push(v);
  }
  if (req.body?.musicEnabled !== undefined) { updates.push('music_enabled = ?'); params.push(req.body.musicEnabled ? 1 : 0); }
  if (!updates.length) return res.status(400).json({ message: '변경할 내용이 없습니다.' });
  await pool.execute(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, [...params, req.session.userId]);
  res.json({ user: toPublicUser(await findUser(req.session.userId)) });
});

module.exports = router;
