const express = require('express');
const pool = require('../db');
const requireAuth = require('../middleware/requireAuth');
const {
  HttpError,
  getDefinitions,
  getStatPoints,
  groupDefinitions,
  validateCharacterInput,
  validateProfileInput,
  DEFAULT_PROFILE_NAME,
  createCharacter,
  updateCharacter,
  createProfile,
  updateProfile,
  deleteProfile,
  setMainProfile,
  getCharacterByUserId,
  withTransaction,
} = require('../characters');

const router = express.Router();

// 현재 입력받는 캐릭터 스탯/프로필 항목 + 투자 포인트 총량 (회원가입 폼에서도 쓰므로 로그인 불필요)
router.get('/attributes', async (req, res) => {
  const [defs, statPoints] = await Promise.all([getDefinitions(), getStatPoints()]);
  res.json({ ...groupDefinitions(defs), statPoints });
});

async function myCharacterId(req) {
  const [rows] = await pool.execute('SELECT id FROM characters WHERE user_id = ?', [req.session.userId]);
  if (!rows[0]) throw new HttpError(404, '캐릭터가 없습니다.');
  return rows[0].id;
}

const sendMine = async (req, res, status = 200) => {
  res.status(status).json({ character: await getCharacterByUserId(req.session.userId) });
};

// 내 캐릭터 (없으면 character: null) — profiles 포함 (대표 프로필이 맨 앞)
router.get('/characters/me', requireAuth, (req, res) => sendMine(req, res));

// 캐릭터 생성 (계정당 1개 — 이미 있으면 409): { name, hp, stats, details } → 대표 프로필 1개 함께 생성
router.post('/characters', requireAuth, async (req, res) => {
  const defs = await getDefinitions();
  const data = validateCharacterInput(req.body, defs, await getStatPoints());
  // 대표 프로필 (이름은 쓰지 않음 — 캐릭터 이름으로 표시)
  const profile = validateProfileInput({ details: req.body?.details }, defs, { defaultName: DEFAULT_PROFILE_NAME });
  await withTransaction((conn) => createCharacter(conn, req.session.userId, data, profile));
  await sendMine(req, res, 201);
});

// 기본정보 + 스탯 수정: { name, hp, stats }  (프로필은 아래 프로필 API 로)
router.put('/characters/me', requireAuth, async (req, res) => {
  const characterId = await myCharacterId(req);
  const data = validateCharacterInput(req.body, await getDefinitions(), await getStatPoints());
  await withTransaction((conn) => updateCharacter(conn, characterId, data));
  await sendMine(req, res);
});

// ---------- 프로필 (여러 개) ----------
// 추가: { name, details }
router.post('/characters/me/profiles', requireAuth, async (req, res) => {
  const characterId = await myCharacterId(req);
  const profile = validateProfileInput(req.body, await getDefinitions());
  await withTransaction((conn) => createProfile(conn, characterId, profile));
  await sendMine(req, res, 201);
});

// 수정: { name, details }  (대표 프로필은 name 없이 details 만)
router.put('/characters/me/profiles/:profileId', requireAuth, async (req, res) => {
  const characterId = await myCharacterId(req);
  const profile = validateProfileInput(req.body, await getDefinitions(), { requireName: false });
  await withTransaction((conn) => updateProfile(conn, characterId, req.params.profileId, profile));
  await sendMine(req, res);
});

// 대표 프로필로 지정
router.put('/characters/me/profiles/:profileId/main', requireAuth, async (req, res) => {
  const characterId = await myCharacterId(req);
  await withTransaction((conn) => setMainProfile(conn, characterId, req.params.profileId));
  await sendMine(req, res);
});

// 삭제 (대표 프로필은 불가)
router.delete('/characters/me/profiles/:profileId', requireAuth, async (req, res) => {
  const characterId = await myCharacterId(req);
  await withTransaction((conn) => deleteProfile(conn, characterId, req.params.profileId));
  await sendMine(req, res);
});

module.exports = router;
