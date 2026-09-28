const express = require('express');
const pool = require('../db');
const requireAuth = require('../middleware/requireAuth');
const {
  HttpError,
  getDefinitions,
  getStatPoints,
  groupDefinitions,
  validateCharacterInput,
  createCharacter,
  updateCharacter,
  getCharacterByUserId,
  withTransaction,
} = require('../characters');

const router = express.Router();

// 현재 입력받는 캐릭터 스탯/프로필 항목 + 투자 포인트 총량 (회원가입 폼에서도 쓰므로 로그인 불필요)
router.get('/attributes', async (req, res) => {
  const [defs, statPoints] = await Promise.all([getDefinitions(), getStatPoints()]);
  res.json({ ...groupDefinitions(defs), statPoints });
});

// 내 캐릭터 (없으면 character: null)
router.get('/characters/me', requireAuth, async (req, res) => {
  res.json({ character: await getCharacterByUserId(req.session.userId) });
});

// 캐릭터 생성 (계정당 1개 — 이미 있으면 409)
router.post('/characters', requireAuth, async (req, res) => {
  const data = validateCharacterInput(req.body, await getDefinitions(), await getStatPoints());
  await withTransaction((conn) => createCharacter(conn, req.session.userId, data));
  res.status(201).json({ character: await getCharacterByUserId(req.session.userId) });
});

// 내 캐릭터 수정
router.put('/characters/me', requireAuth, async (req, res) => {
  const [rows] = await pool.execute('SELECT id FROM characters WHERE user_id = ?', [req.session.userId]);
  if (!rows[0]) throw new HttpError(404, '캐릭터가 없습니다.');
  const data = validateCharacterInput(req.body, await getDefinitions(), await getStatPoints());
  await withTransaction((conn) => updateCharacter(conn, rows[0].id, data));
  res.json({ character: await getCharacterByUserId(req.session.userId) });
});

module.exports = router;
