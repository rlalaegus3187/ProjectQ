// 캐릭터(기본정보 / 캐릭터 스탯 / 프로필)와 수집 항목 정의(attribute_definitions) 처리
const pool = require('./db');

const MAX_INT = 2147483647;

// 항목 형식 (캐릭터 스탯 / 프로필 양식 공통)
const VALUE_TYPES = ['number', 'text', 'long_text', 'link', 'image', 'select'];
const MAX_LENGTH = { text: 500, long_text: 10000, link: 2000 };
// 이미지 값은 이 서버에 업로드한 파일 경로만 허용 (routes/uploads.js)
const UPLOAD_URL_RE = /^\/api\/uploads\/[a-f0-9]{32}\.(png|jpg|gif|webp)$/;

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
    this.expose = true;
  }
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
    case 'number':
      if (!Number.isFinite(Number(text))) fail('숫자로 입력해주세요.');
      return String(Number(text));
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

// 캐릭터 입력 전체 검증: { name, hp, stats: {code: value}, details: {code: value} }
function validateCharacterInput(input, defs) {
  const name = String(input?.name ?? '').trim();
  if (!name || name.length > 50) throw new HttpError(400, '캐릭터 이름은 1~50자로 입력해주세요.');

  const hpText = String(input?.hp ?? '').trim();
  const hp = Number(hpText);
  if (hpText === '' || !Number.isInteger(hp) || hp < 0 || hp > MAX_INT) {
    throw new HttpError(400, 'HP는 0 이상의 정수로 입력해주세요.');
  }

  const { stats, details } = groupDefinitions(defs);
  return {
    name,
    hp,
    stats: validateValues(input?.stats, stats),
    details: validateValues(input?.details, details),
  };
}

async function saveValues(conn, table, characterId, values) {
  for (const { def, value } of values) {
    if (value === null) {
      await conn.execute(`DELETE FROM ${table} WHERE character_id = ? AND definition_id = ?`, [characterId, def.id]);
    } else {
      await conn.execute(
        `INSERT INTO ${table} (character_id, definition_id, value) VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE value = VALUES(value)`,
        [characterId, def.id, value],
      );
    }
  }
}

// conn 은 트랜잭션 중인 커넥션. data 는 validateCharacterInput 결과
async function createCharacter(conn, userId, data) {
  try {
    const [result] = await conn.execute(
      'INSERT INTO characters (user_id, name, hp) VALUES (?, ?, ?)',
      [userId, data.name, data.hp],
    );
    await saveValues(conn, 'character_stats', result.insertId, data.stats);
    await saveValues(conn, 'character_details', result.insertId, data.details);
    return result.insertId;
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') throw new HttpError(409, '이미 캐릭터가 있습니다. (계정당 1개)');
    throw err;
  }
}

async function updateCharacter(conn, characterId, data) {
  await conn.execute('UPDATE characters SET name = ?, hp = ? WHERE id = ?', [data.name, data.hp, characterId]);
  await saveValues(conn, 'character_stats', characterId, data.stats);
  await saveValues(conn, 'character_details', characterId, data.details);
}

// 활성 항목 기준으로 값을 붙여서 반환 (값이 없는 항목은 value: null)
async function getCharacterByUserId(userId, conn = pool) {
  const [rows] = await conn.execute(
    'SELECT id, name, hp, created_at, updated_at FROM characters WHERE user_id = ?',
    [userId],
  );
  const character = rows[0];
  if (!character) return null;

  const defs = await getDefinitions(conn);
  const [statRows] = await conn.execute('SELECT definition_id, value FROM character_stats WHERE character_id = ?', [character.id]);
  const [detailRows] = await conn.execute('SELECT definition_id, value FROM character_details WHERE character_id = ?', [character.id]);
  const statValues = new Map(statRows.map((r) => [r.definition_id, r.value]));
  const detailValues = new Map(detailRows.map((r) => [r.definition_id, r.value]));
  const { stats, details } = groupDefinitions(defs);
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
    stats: stats.map(withValue(statValues)),
    details: details.map(withValue(detailValues)),
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
  HttpError,
  getDefinitions,
  groupDefinitions,
  validateCharacterInput,
  createCharacter,
  updateCharacter,
  getCharacterByUserId,
  withTransaction,
};
