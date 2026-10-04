// 캐릭터(기본정보 / 캐릭터 스탯 / 프로필)와 수집 항목 정의(attribute_definitions) 처리
const pool = require('./db');

const MAX_INT = 2147483647;

// 항목 형식 (캐릭터 스탯 / 프로필 양식 공통)
const VALUE_TYPES = ['number', 'text', 'long_text', 'link', 'image', 'select'];
const MAX_LENGTH = { text: 500, long_text: 10000, link: 2000 };
// 이미지 값은 이 서버에 업로드한 파일 경로만 허용 (routes/uploads.js)
const UPLOAD_URL_RE = /^\/api\/uploads\/[a-f0-9]{32}\.(png|jpg|gif|webp)$/;

const { HttpError } = require('./errors');
const { parseYouTubeId } = require('./youtube');

// 숫자형 캐릭터 스탯 = 투자 포인트를 분배하는 스탯 (0 이상의 정수, 합계 ≤ 투자 포인트)
const isPointStat = (def) => def.category === 'stat' && def.valueType === 'number';
const STAT_POINTS_KEY = 'stat_initial_points';

async function getStatPoints(conn = pool) {
  const [rows] = await conn.execute('SELECT value FROM settings WHERE name = ?', [STAT_POINTS_KEY]);
  const n = Number(rows[0]?.value);
  return Number.isInteger(n) && n >= 0 ? n : 0;
}

async function setStatPoints(value, conn = pool) {
  await conn.execute(
    'INSERT INTO settings (name, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value = VALUES(value)',
    [STAT_POINTS_KEY, String(value)],
  );
}

// 사용한 포인트 = 숫자형 스탯 값의 합 (validateValues 결과 또는 { def, value } 목록)
function usedStatPoints(values) {
  return values.filter(({ def, value }) => isPointStat(def) && value !== null)
    .reduce((sum, { value }) => sum + Number(value), 0);
}

function parseOptions(value) {
  if (value === null || value === undefined) return null;
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function toDefinition(row) {
  return {
    id: row.id,
    category: row.category,
    code: row.code,
    label: row.label,
    valueType: row.value_type,
    options: parseOptions(row.options),
    isRequired: !!row.is_required,
    sortOrder: row.sort_order,
    isActive: !!row.is_active,
  };
}

async function getDefinitions(conn = pool, { activeOnly = true } = {}) {
  const [rows] = await conn.query(
    `SELECT id, category, code, label, value_type, options, is_required, sort_order, is_active
       FROM attribute_definitions
      ${activeOnly ? 'WHERE is_active = 1' : ''}
      ORDER BY category, sort_order, id`,
  );
  return rows.map(toDefinition);
}

function groupDefinitions(defs) {
  return {
    stats: defs.filter((d) => d.category === 'stat'),
    details: defs.filter((d) => d.category === 'detail'),
  };
}

// { code: value } 입력을 정의에 맞춰 검증 → [{ def, value | null }]
// 입력이 비어 있으면 null (저장 시 삭제). 필수 항목이 비어 있으면 400.
function validateValues(raw, defs) {
  const input = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const byCode = new Map(defs.map((d) => [d.code, d]));
  for (const code of Object.keys(input)) {
    if (!byCode.has(code)) throw new HttpError(400, `알 수 없는 항목입니다: ${code}`);
  }

  return defs.map((def) => {
    const rawValue = input[def.code];
    const text = rawValue === undefined || rawValue === null ? '' : String(rawValue).trim();
    if (!text) {
      if (def.isRequired) throw new HttpError(400, `${def.label}: 필수 항목입니다.`);
      return { def, value: null };
    }
    return { def, value: validateValue(def, text) };
  });
}

// 형식별 값 검증 → 저장할 문자열
function validateValue(def, text) {
  const fail = (message) => { throw new HttpError(400, `${def.label}: ${message}`); };
  const max = MAX_LENGTH[def.valueType];
  if (max && text.length > max) fail(`${max}자 이내로 입력해주세요.`);

  switch (def.valueType) {
    case 'number': {
      const n = Number(text);
      if (!Number.isFinite(n)) fail('숫자로 입력해주세요.');
      if (isPointStat(def) && (!Number.isInteger(n) || n < 0 || n > MAX_INT)) fail('0 이상의 정수로 입력해주세요.');
      return String(n);
    }
    case 'link': {
      let url;
      try { url = new URL(text); } catch { fail('올바른 링크(http:// 또는 https://)를 입력해주세요.'); }
      if (!['http:', 'https:'].includes(url.protocol)) fail('http:// 또는 https:// 링크만 입력할 수 있습니다.');
      return text;
    }
    case 'image':
      if (!UPLOAD_URL_RE.test(text)) fail('이미지를 다시 업로드해주세요.');
      return text;
    case 'select':
      if (!(def.options || []).includes(text)) fail('목록에 있는 값을 선택해주세요.');
      return text;
    default: // text, long_text
      return text;
  }
}

const MAX_PROFILES = 10;
const APPLICANT_MAX_PROFILES = 1;   // 신청자는 프로필 1개만
const DEFAULT_PROFILE_NAME = '기본 프로필';

// 권한 (users.role): 관리자 / 멤버 / 신청자
const ROLES = ['admin', 'member', 'applicant'];
const MEMBER_ROLES = ['admin', 'member'];   // 멤버란에 보이는 권한
const maxProfilesFor = (role) => (role === 'applicant' ? APPLICANT_MAX_PROFILES : MAX_PROFILES);
// 신청자가 신청서를 '작성완료'로 제출하면 수정 잠금 (작성중으로 되돌리면 다시 수정 가능)
// 제출한 뒤에도 수정할 수 있음 (잠금 없음) — 예전 '작성완료면 잠금' 규칙은 없앰. locked 는 호환용으로 항상 false
const isLocked = () => false;

async function getOwnerInfo(conn, characterId, { lock = false } = {}) {
  const [rows] = await conn.execute(
    `SELECT c.id, c.user_id, c.application_status, u.role
       FROM characters c JOIN users u ON u.id = c.user_id
      WHERE c.id = ?${lock ? ' FOR UPDATE' : ''}`,
    [characterId],
  );
  if (!rows[0]) throw new HttpError(404, '캐릭터를 찾을 수 없습니다.');
  return rows[0];
}

// 신청서가 잠겨 있으면(신청자 + 작성완료) 수정 불가
async function assertEditable(conn, characterId) {
  const info = await getOwnerInfo(conn, characterId, { lock: true });
  if (isLocked(info.role, info.application_status)) {
    throw new HttpError(409, '작성완료로 제출한 신청서는 수정할 수 없습니다. 작성중으로 되돌린 뒤 수정해주세요.');
  }
  return info;
}

// 캐릭터 입력 검증 (기본정보 + 스탯): { name, hp, stats: {code: value} }
// statPoints: 투자 포인트 총량 (숫자형 스탯 합계 상한). null 이면 검사 안 함
function validateCharacterInput(input, defs, statPoints = null) {
  const name = String(input?.name ?? '').trim();
  if (!name || name.length > 50) throw new HttpError(400, '캐릭터 이름은 1~50자로 입력해주세요.');

  const hpText = String(input?.hp ?? '').trim();
  const hp = Number(hpText);
  if (hpText === '' || !Number.isInteger(hp) || hp < 0 || hp > MAX_INT) {
    throw new HttpError(400, 'HP는 0 이상의 정수로 입력해주세요.');
  }

  const { stats } = groupDefinitions(defs);
  const statValues = validateValues(input?.stats, stats);
  const used = usedStatPoints(statValues);
  if (statPoints !== null && used > statPoints) {
    throw new HttpError(400, `스탯에 투자한 포인트(${used})가 전체 포인트(${statPoints})보다 많습니다.`);
  }
  return { name, hp, stats: statValues };
}

// 프로필 입력 검증: { name, details: {code: value} }
// 대표 프로필은 이름 없이 캐릭터 이름으로 표시 → requireName: false 면 이름을 비워도 됨 (비면 defaultName)
function validateProfileInput(input, defs, { defaultName = null, requireName = true } = {}) {
  const name = String(input?.name ?? '').trim() || defaultName || '';
  if (name.length > 50) throw new HttpError(400, '프로필 이름은 50자 이내로 입력해주세요.');
  if (requireName && !name) throw new HttpError(400, '프로필 이름을 입력해주세요.');
  const { details } = groupDefinitions(defs);
  // 프로필 음악: 유튜브 링크 → 영상 ID (비우면 음악 없음)
  const musicVideoId = parseYouTubeId(input?.music, '프로필 음악');
  return { name, musicVideoId, details: validateValues(input?.details, details) };
}

// 값 저장: keyColumn = character_id(스탯) / profile_id(프로필)
async function saveValues(conn, table, keyColumn, keyId, values) {
  for (const { def, value } of values) {
    if (value === null) {
      await conn.execute(`DELETE FROM ${table} WHERE ${keyColumn} = ? AND definition_id = ?`, [keyId, def.id]);
    } else {
      await conn.execute(
        `INSERT INTO ${table} (${keyColumn}, definition_id, value) VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE value = VALUES(value)`,
        [keyId, def.id, value],
      );
    }
  }
}

// conn 은 트랜잭션 중인 커넥션. data = validateCharacterInput 결과, profile = validateProfileInput 결과
// 캐릭터와 함께 대표 프로필 1개를 만듦
async function createCharacter(conn, userId, data, profile) {
  let characterId;
  try {
    const [result] = await conn.execute(
      'INSERT INTO characters (user_id, name, hp) VALUES (?, ?, ?)',
      [userId, data.name, data.hp],
    );
    characterId = result.insertId;
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') throw new HttpError(409, '이미 캐릭터가 있습니다. (계정당 1개)');
    throw err;
  }
  await saveValues(conn, 'character_stats', 'character_id', characterId, data.stats);
  await createProfile(conn, characterId, profile, { isMain: true });
  return characterId;
}

// 기본정보 + 스탯만 수정 (프로필은 따로)
async function updateCharacter(conn, characterId, data) {
  await conn.execute('UPDATE characters SET name = ?, hp = ? WHERE id = ?', [data.name, data.hp, characterId]);
  await saveValues(conn, 'character_stats', 'character_id', characterId, data.stats);
}

// ---------- 프로필 ----------
async function createProfile(conn, characterId, profile, { isMain = false } = {}) {
  const [[{ count, maxOrder }]] = await conn.query(
    'SELECT COUNT(*) AS count, COALESCE(MAX(sort_order), 0) AS maxOrder FROM character_profiles WHERE character_id = ? FOR UPDATE',
    [characterId],
  );
  const { role } = await getOwnerInfo(conn, characterId);
  const max = maxProfilesFor(role);
  if (Number(count) >= max) {
    throw new HttpError(400, role === 'applicant'
      ? '신청자는 프로필을 1개만 등록할 수 있습니다.'
      : `프로필은 최대 ${max}개까지 만들 수 있습니다.`);
  }
  const [result] = await conn.execute(
    'INSERT INTO character_profiles (character_id, name, music_video_id, is_main, sort_order) VALUES (?, ?, ?, ?, ?)',
    [characterId, profile.name, profile.musicVideoId ?? null, isMain || Number(count) === 0 ? 1 : 0, Number(maxOrder) + 1],
  );
  await saveValues(conn, 'character_details', 'profile_id', result.insertId, profile.details);
  return result.insertId;
}

// 내 캐릭터의 프로필인지 확인 → 프로필 행
async function findProfile(conn, characterId, profileId) {
  const [rows] = await conn.execute(
    'SELECT id, is_main FROM character_profiles WHERE id = ? AND character_id = ? FOR UPDATE',
    [Number(profileId), characterId],
  );
  if (!rows[0]) throw new HttpError(404, '프로필을 찾을 수 없습니다.');
  return rows[0];
}

// 대표 프로필은 이름을 쓰지 않으므로(캐릭터 이름으로 표시) 이름은 그대로 두고 값만 수정
async function updateProfile(conn, characterId, profileId, profile) {
  const row = await findProfile(conn, characterId, profileId);
  await conn.execute('UPDATE character_profiles SET music_video_id = ? WHERE id = ?', [profile.musicVideoId ?? null, row.id]);
  if (!row.is_main) {
    if (!profile.name) throw new HttpError(400, '프로필 이름을 입력해주세요.');
    await conn.execute('UPDATE character_profiles SET name = ? WHERE id = ?', [profile.name, row.id]);
  }
  await saveValues(conn, 'character_details', 'profile_id', row.id, profile.details);
}

// 대표 프로필은 삭제 불가 (다른 프로필을 대표로 지정한 뒤 삭제)
async function deleteProfile(conn, characterId, profileId) {
  const row = await findProfile(conn, characterId, profileId);
  if (row.is_main) throw new HttpError(400, '대표 프로필은 삭제할 수 없습니다. 다른 프로필을 대표로 지정한 뒤 삭제해주세요.');
  await conn.execute('DELETE FROM character_profiles WHERE id = ?', [row.id]);
}

async function setMainProfile(conn, characterId, profileId) {
  const row = await findProfile(conn, characterId, profileId);
  await conn.execute('UPDATE character_profiles SET is_main = (id = ?) WHERE character_id = ?', [row.id, characterId]);
}

// 활성 항목 기준으로 값을 붙여서 반환 (값이 없는 항목은 value: null)
// profiles: 대표 프로필이 맨 앞, 나머지는 만든 순서
async function getCharacterByUserId(userId, conn = pool) {
  return getCharacter({ userId }, conn);
}

// { userId } 또는 { characterId } 로 조회 (멤버란은 characterId)
async function getCharacter({ userId, characterId }, conn = pool) {
  const [rows] = await conn.execute(
    `SELECT c.id, c.name, c.hp, c.money, c.application_status, c.submitted_at, c.created_at, c.updated_at, u.role
       FROM characters c JOIN users u ON u.id = c.user_id
      WHERE c.${userId !== undefined ? 'user_id' : 'id'} = ?`,
    [Number(userId !== undefined ? userId : characterId)],
  );
  const character = rows[0];
  if (!character) return null;

  const [defs, totalPoints] = await Promise.all([getDefinitions(conn), getStatPoints(conn)]);
  const [statRows] = await conn.execute('SELECT definition_id, value FROM character_stats WHERE character_id = ?', [character.id]);
  const [profileRows] = await conn.execute(
    'SELECT id, name, music_video_id, is_main, created_at, updated_at FROM character_profiles WHERE character_id = ? ORDER BY is_main DESC, sort_order, id',
    [character.id],
  );
  const [detailRows] = profileRows.length
    ? await conn.query('SELECT profile_id, definition_id, value FROM character_details WHERE profile_id IN (?)', [profileRows.map((p) => p.id)])
    : [[]];

  const statValues = new Map(statRows.map((r) => [r.definition_id, r.value]));
  const { stats, details } = groupDefinitions(defs);
  const usedPoints = usedStatPoints(stats.map((def) => ({ def, value: statValues.get(def.id) ?? null })));
  const withValue = (valueMap) => (def) => ({
    code: def.code,
    label: def.label,
    valueType: def.valueType,
    value: valueMap.has(def.id) ? valueMap.get(def.id) : null,
  });

  return {
    id: character.id,
    name: character.name,
    hp: character.hp,
    money: Number(character.money),
    stats: stats.map(withValue(statValues)),
    statPoints: { total: totalPoints, used: usedPoints },
    profiles: profileRows.map((p) => {
      const values = new Map(detailRows.filter((d) => d.profile_id === p.id).map((d) => [d.definition_id, d.value]));
      return {
        id: p.id, name: p.name, isMain: !!p.is_main, musicVideoId: p.music_video_id, details: details.map(withValue(values)), updatedAt: p.updated_at,
      };
    }),
    maxProfiles: maxProfilesFor(character.role),
    ownerRole: character.role,
    // 신청 상태 (신청자만 의미 있음): draft 작성중 / submitted 작성완료, locked = 수정 잠금
    applicationStatus: character.application_status,
    submittedAt: character.submitted_at,
    locked: isLocked(character.role, character.application_status),
    createdAt: character.created_at,
    updatedAt: character.updated_at,
  };
}

// 트랜잭션 헬퍼: fn(conn) 이 성공하면 commit, 실패하면 rollback
async function withTransaction(fn) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

module.exports = {
  VALUE_TYPES,
  UPLOAD_URL_RE,
  isPointStat,
  getStatPoints,
  setStatPoints,
  HttpError,
  getDefinitions,
  groupDefinitions,
  validateCharacterInput,
  validateProfileInput,
  DEFAULT_PROFILE_NAME,
  ROLES,
  MEMBER_ROLES,
  assertEditable,
  createCharacter,
  updateCharacter,
  createProfile,
  updateProfile,
  deleteProfile,
  setMainProfile,
  getCharacterByUserId,
  getCharacter,
  withTransaction,
};
