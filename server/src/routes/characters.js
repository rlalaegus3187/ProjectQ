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
const { isProfileAddOpen, isProfileEditOpen, isStatsEnabled, getSetting } = require('../settings');

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
// statsEnabled: 캐릭터 스탯 사용 여부 (관리 → 캐릭터 항목에서 끄면 스탯 입력칸을 숨김)
router.get('/attributes', async (req, res) => {
  const [defs, statPoints, statsEnabled] = await Promise.all([getDefinitions(), getStatPoints(), isStatsEnabled()]);
  res.json({ ...groupDefinitions(defs), statPoints, statsEnabled });
});

// 캐릭터 입력 검증 — 스탯 미사용이면 보낸 스탯 값은 무시하고 검사·저장하지 않음 (저장된 값은 그대로)
async function validateCharacter(body, defs) {
  if (await isStatsEnabled()) return validateCharacterInput(body, defs, await getStatPoints());
  return validateCharacterInput({ ...body, stats: {} }, defs.filter((d) => d.category !== 'stat'));
}

async function myCharacterId(req) {
  const [rows] = await pool.execute('SELECT id FROM characters WHERE user_id = ?', [req.session.userId]);
  if (!rows[0]) throw new HttpError(404, '캐릭터가 없습니다.');
  return rows[0].id;
}

// 신청자가 제출한 신청서를 수정·취소하면 제출을 취소하고 작성중으로 되돌림 (다시 [신청서 제출] 해야 함) → 되돌렸으면 true
async function revertSubmission(conn, characterId) {
  const [result] = await conn.execute(
    `UPDATE characters c JOIN users u ON u.id = c.user_id
        SET c.application_status = 'draft', c.submitted_at = NULL
      WHERE c.id = ? AND u.role = 'applicant' AND c.application_status = 'submitted'`,
    [characterId],
  );
  return result.affectedRows > 0;
}

async function notifyCanceled(characterId) {
  const [[c]] = await pool.execute('SELECT name FROM characters WHERE id = ?', [characterId]);
  await notifyAdmins({ type: 'application', message: `${c.name} 님이 신청서 제출을 취소했습니다.`, link: '/admin/applicants' });
}

// 수정 API 공통: 내 캐릭터 id 를 찾아 트랜잭션 안에서 fn 실행
// 제출한 신청서를 고치면 제출 취소(작성중) — 관리자에게 알림
async function editMine(req, fn) {
  const characterId = await myCharacterId(req);
  const reverted = await withTransaction(async (conn) => {
    await assertEditable(conn, characterId);
    await fn(conn, characterId);
    return revertSubmission(conn, characterId);
  });
  if (reverted) await notifyCanceled(characterId);
}

const sendMine = async (req, res, status = 200) => {
  res.status(status).json({ character: await getCharacterByUserId(req.session.userId) });
};

// 내 캐릭터 (없으면 character: null) — profiles 포함 (대표 프로필이 맨 앞)
router.get('/characters/me', requireAuth, (req, res) => sendMine(req, res));

// 캐릭터 생성 (계정당 1개 — 이미 있으면 409): { name, hp, stats, details, music? } → 대표 프로필 1개 함께 생성
router.post('/characters', requireAuth, async (req, res) => {
  const defs = await getDefinitions();
  const data = await validateCharacter(req.body, defs);
  // 대표 프로필 (이름은 쓰지 않음 — 캐릭터 이름으로 표시)
  const profile = validateProfileInput({ details: req.body?.details, music: req.body?.music }, defs, { defaultName: DEFAULT_PROFILE_NAME });
  await withTransaction((conn) => createCharacter(conn, req.session.userId, data, profile));
  await sendMine(req, res, 201);
});

// 기본정보 + 스탯 수정: { name, hp, stats }  (프로필은 아래 프로필 API 로)
router.put('/characters/me', requireAuth, async (req, res) => {
  const data = await validateCharacter(req.body, await getDefinitions());
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
// 신청서 제출 동의사항 (관리 → 사이트 설정에서 작성, 마크다운)
router.get('/characters/me/application-notice', requireAuth, async (req, res) => {
  res.json({ notice: (await getSetting('application_notice')) || '' });
});

// 신청서 제출 (신청자, 처음 한 번): { agree: true } — 관리 → 사이트 설정의 '신청서 제출 동의사항'에 동의해야 함
// 제출한 뒤에 수정·취소하면 작성중으로 돌아가고, 다시 제출할 때 또 동의 (저장할 때는 동의 필요 없음)
router.post('/characters/me/application/submit', requireAuth, async (req, res) => {
  if (req.body?.agree !== true) throw new HttpError(400, '신청서 제출 동의사항에 동의해주세요.');
  const characterId = await myCharacterId(req);
  const [[user]] = await pool.execute('SELECT role FROM users WHERE id = ?', [req.session.userId]);
  if (user?.role !== 'applicant') throw new HttpError(400, '신청자만 신청서를 제출할 수 있습니다.');
  const [result] = await pool.execute(
    "UPDATE characters SET application_status = 'submitted', submitted_at = NOW() WHERE id = ? AND application_status = 'draft'",
    [characterId],
  );
  if (!result.affectedRows) throw new HttpError(409, '이미 제출한 신청서입니다.');
  const [[c]] = await pool.execute('SELECT name FROM characters WHERE id = ?', [characterId]);
  await notifyAdmins({ type: 'application', message: `${c.name} 님이 신청서를 제출했습니다.`, link: '/admin/applicants' });
  await sendMine(req, res);
});

// 신청서 제출 취소 (신청자) → 작성중으로 되돌림
router.post('/characters/me/application/cancel', requireAuth, async (req, res) => {
  const characterId = await myCharacterId(req);
  if (!(await revertSubmission(pool, characterId))) throw new HttpError(409, '제출한 신청서가 아닙니다.');
  await notifyCanceled(characterId);
  await sendMine(req, res);
});

module.exports = router;
