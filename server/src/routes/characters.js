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
  assertEditable,
  createCharacter,
  updateCharacter,
  createProfile,
  updateProfile,
  deleteProfile,
  setMainProfile,
  getCharacterByUserId,
  withTransaction,
} = require('../characters');
const { notifyAdmins } = require('../notify');
const { isProfileAddOpen, isProfileEditOpen } = require('../settings');

// 프로필 추가/수정이 막혀 있으면(관리 → 사이트 설정) 403 — 관리자는 항상 가능
//   kind: 'add' (새 프로필) | 'edit' (수정·삭제·대표 지정)
async function assertProfileAllowed(req, kind) {
  const [[user]] = await pool.execute('SELECT role FROM users WHERE id = ?', [req.session.userId]);
  if (user?.role === 'admin') return;
  if (kind === 'add' && !(await isProfileAddOpen())) throw new HttpError(403, '지금은 프로필을 추가할 수 없습니다.');
  if (kind === 'edit' && !(await isProfileEditOpen())) throw new HttpError(403, '지금은 프로필을 수정할 수 없습니다.');
}

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

// 수정 API 공통: 내 캐릭터 id 를 찾고, 신청서가 잠겨 있으면(작성완료) 409 → 트랜잭션 안에서 fn 실행
async function editMine(req, fn) {
  const characterId = await myCharacterId(req);
  await withTransaction(async (conn) => {
    await assertEditable(conn, characterId);
    await fn(conn, characterId);
  });
}

const sendMine = async (req, res, status = 200) => {
  res.status(status).json({ character: await getCharacterByUserId(req.session.userId) });
};

// 내 캐릭터 (없으면 character: null) — profiles 포함 (대표 프로필이 맨 앞)
router.get('/characters/me', requireAuth, (req, res) => sendMine(req, res));

// 캐릭터 생성 (계정당 1개 — 이미 있으면 409): { name, hp, stats, details, music? } → 대표 프로필 1개 함께 생성
router.post('/characters', requireAuth, async (req, res) => {
  const defs = await getDefinitions();
  const data = validateCharacterInput(req.body, defs, await getStatPoints());
  // 대표 프로필 (이름은 쓰지 않음 — 캐릭터 이름으로 표시)
  const profile = validateProfileInput({ details: req.body?.details, music: req.body?.music }, defs, { defaultName: DEFAULT_PROFILE_NAME });
  await withTransaction((conn) => createCharacter(conn, req.session.userId, data, profile));
  await sendMine(req, res, 201);
});

// 기본정보 + 스탯 수정: { name, hp, stats }  (프로필은 아래 프로필 API 로)
router.put('/characters/me', requireAuth, async (req, res) => {
  const data = validateCharacterInput(req.body, await getDefinitions(), await getStatPoints());
  await editMine(req, (conn, characterId) => updateCharacter(conn, characterId, data));
  await sendMine(req, res);
});

// ---------- 프로필 (여러 개) ----------
// 추가: { name, music?(유튜브 링크), details }
router.post('/characters/me/profiles', requireAuth, async (req, res) => {
  await assertProfileAllowed(req, 'add');
  const profile = validateProfileInput(req.body, await getDefinitions());
  await editMine(req, (conn, characterId) => createProfile(conn, characterId, profile));
  await sendMine(req, res, 201);
});

// 수정: { name, music?, details }  (대표 프로필은 name 없이)
router.put('/characters/me/profiles/:profileId', requireAuth, async (req, res) => {
  await assertProfileAllowed(req, 'edit');
  const profile = validateProfileInput(req.body, await getDefinitions(), { requireName: false });
  await editMine(req, (conn, characterId) => updateProfile(conn, characterId, req.params.profileId, profile));
  await sendMine(req, res);
});

// 대표 프로필로 지정
router.put('/characters/me/profiles/:profileId/main', requireAuth, async (req, res) => {
  await assertProfileAllowed(req, 'edit');
  await editMine(req, (conn, characterId) => setMainProfile(conn, characterId, req.params.profileId));
  await sendMine(req, res);
});

// 삭제 (대표 프로필은 불가)
router.delete('/characters/me/profiles/:profileId', requireAuth, async (req, res) => {
  await assertProfileAllowed(req, 'edit');
  await editMine(req, (conn, characterId) => deleteProfile(conn, characterId, req.params.profileId));
  await sendMine(req, res);
});

// ---------- 신청서 상태 (신청자만) ----------
// { status: 'submitted' (작성완료 제출) | 'draft' (작성중으로 되돌리기) }
// 신청서 제출 동의사항 (관리 → 사이트 설정에서 작성, 마크다운)
router.get('/characters/me/application-notice', requireAuth, async (req, res) => {
  res.json({ notice: (await require('../settings').getSetting('application_notice')) || '' });
});

// 신청서 제출 (신청자, 처음 한 번): { agree: true } — 관리 → 사이트 설정의 '신청서 제출 동의사항'에 동의해야 함
// 제출한 뒤에도 프로필·캐릭터는 계속 수정할 수 있음 (저장할 때는 동의 필요 없음)
router.post('/characters/me/application/submit', requireAuth, async (req, res) => {
  if (req.body?.agree !== true) throw new HttpError(400, '신청서 제출 동의사항에 동의해주세요.');
  const characterId = await myCharacterId(req);
  const [[user]] = await pool.execute('SELECT role FROM users WHERE id = ?', [req.session.userId]);
  if (user?.role !== 'applicant') throw new HttpError(400, '신청자만 신청서를 제출할 수 있습니다.');
  const [result] = await pool.execute(
    "UPDATE characters SET application_status = 'submitted', submitted_at = NOW() WHERE id = ? AND application_status = 'draft'",
    [characterId],
  );
  if (!result.affectedRows) throw new HttpError(409, '이미 제출한 신청서입니다. 내용은 그대로 수정하면 됩니다.');
  const [[c]] = await pool.execute('SELECT name FROM characters WHERE id = ?', [characterId]);
  await notifyAdmins({ type: 'application', message: `${c.name} 님이 신청서를 제출했습니다.`, link: '/admin/applicants' });
  await sendMine(req, res);
});

module.exports = router;
