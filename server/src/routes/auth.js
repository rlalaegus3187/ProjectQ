const express = require('express');
const rateLimit = require('express-rate-limit');
const pool = require('../db');
const { hashPassword, verifyPassword } = require('../password');
const requireAuth = require('../middleware/requireAuth');
const config = require('../config');
const {
  getDefinitions, getStatPoints, validateCharacterInput, validateProfileInput, DEFAULT_PROFILE_NAME, createCharacter, withTransaction,
} = require('../characters');

const router = express.Router();

// 로그인/회원가입 무차별 대입 방지: IP 당 15분에 20회
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { message: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' },
});

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const USER_COLUMNS = 'id, email, name, role, music_volume, music_enabled, created_at';

function toPublicUser(row) {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    // 계정별 음악 설정 (음악 모듈이 사용)
    musicVolume: row.music_volume,
    musicEnabled: !!row.music_enabled,
    createdAt: row.created_at,
  };
}

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

router.post('/signup', authLimiter, async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const name = String(req.body?.name || '').trim();
  const password = String(req.body?.password || '');

  if (!EMAIL_RE.test(email)) return res.status(400).json({ message: '이메일 형식이 올바르지 않습니다.' });
  if (!name || name.length > 50) return res.status(400).json({ message: '이름은 1~50자로 입력해주세요.' });
  if (password.length < 8) return res.status(400).json({ message: '비밀번호는 8자 이상이어야 합니다.' });

  // 가입과 동시에 캐릭터 1개 등록 (계정·캐릭터를 한 트랜잭션으로 저장)
  const defs = await getDefinitions();
  const character = validateCharacterInput(req.body?.character, defs, await getStatPoints());
  // 대표 프로필: { details } (이름은 쓰지 않음 — 캐릭터 이름으로 표시)
  const profile = validateProfileInput(
    { details: req.body?.character?.details, music: req.body?.character?.music },
    defs,
    { defaultName: DEFAULT_PROFILE_NAME },
  );
  const passwordHash = await hashPassword(password);

  let userId;
  try {
    userId = await withTransaction(async (conn) => {
      const [result] = await conn.execute(
        'INSERT INTO users (email, name, role, password_hash) VALUES (?, ?, ?, ?)',
        [email, name, config.signupRole, passwordHash],
      );
      await createCharacter(conn, result.insertId, character, profile);
      return result.insertId;
    });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: '이미 가입된 이메일입니다.' });
    throw err;
  }

  await startSession(req, userId);
  const [rows] = await pool.execute(`SELECT ${USER_COLUMNS} FROM users WHERE id = ?`, [userId]);
  res.status(201).json({ user: toPublicUser(rows[0]) });
});

router.post('/login', authLimiter, async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');

  const [rows] = await pool.execute(
    `SELECT ${USER_COLUMNS}, password_hash FROM users WHERE email = ?`,
    [email],
  );
  const user = rows[0];
  // 이메일 존재 여부를 노출하지 않도록 같은 메시지 사용
  if (!user || !(await verifyPassword(password, user.password_hash))) {
    return res.status(401).json({ message: '이메일 또는 비밀번호가 올바르지 않습니다.' });
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
  const [rows] = await pool.execute(`SELECT ${USER_COLUMNS} FROM users WHERE id = ?`, [req.session.userId]);
  if (!rows[0]) {
    req.session.destroy(() => {});
    return res.status(401).json({ message: '로그인이 필요합니다.' });
  }
  res.json({ user: toPublicUser(rows[0]) });
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
  const [rows] = await pool.execute(`SELECT ${USER_COLUMNS} FROM users WHERE id = ?`, [req.session.userId]);
  res.json({ user: toPublicUser(rows[0]) });
});

module.exports = router;
