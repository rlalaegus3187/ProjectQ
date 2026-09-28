const express = require('express');
const rateLimit = require('express-rate-limit');
const pool = require('../db');
const { hashPassword, verifyPassword } = require('../password');
const requireAuth = require('../middleware/requireAuth');

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

function toPublicUser(row) {
  return { id: row.id, email: row.email, name: row.name, createdAt: row.created_at };
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

  try {
    const passwordHash = await hashPassword(password);
    const [result] = await pool.execute(
      'INSERT INTO users (email, name, password_hash) VALUES (?, ?, ?)',
      [email, name, passwordHash],
    );
    await startSession(req, result.insertId);
    const [rows] = await pool.execute('SELECT id, email, name, created_at FROM users WHERE id = ?', [result.insertId]);
    res.status(201).json({ user: toPublicUser(rows[0]) });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: '이미 가입된 이메일입니다.' });
    throw err;
  }
});

router.post('/login', authLimiter, async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');

  const [rows] = await pool.execute(
    'SELECT id, email, name, password_hash, created_at FROM users WHERE email = ?',
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
  const [rows] = await pool.execute('SELECT id, email, name, created_at FROM users WHERE id = ?', [req.session.userId]);
  if (!rows[0]) {
    req.session.destroy(() => {});
    return res.status(401).json({ message: '로그인이 필요합니다.' });
  }
  res.json({ user: toPublicUser(rows[0]) });
});

module.exports = router;
