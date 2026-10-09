// 아이템 효과 종류 (item_effects 테이블) — 관리 → 아이템 관리 → 아이템 효과에서 추가·수정·삭제
//   code    프로그램용 키 (영문 소문자로 시작, 소문자·숫자·_ 2~30자) — 만든 뒤 바꿀 수 없음
//   label   화면에 보이는 이름 (예: HP 회복)
//   example 효과수치 JSON 예시 (아이템 수정 화면의 '예시 넣기')
// 'none'(효과 없음)은 기본값이라 지울 수 없음
const pool = require('./db');
const { HttpError } = require('./errors');

const CODE_RE = /^[a-z][a-z0-9_]{1,29}$/;
const DEFAULT_EFFECT = 'none';

const toEffect = (r) => ({
  code: r.code,
  label: r.label,
  example: r.example || '{}',
  description: r.description || '',
  sortOrder: r.sort_order,
  ...(r.item_count !== undefined ? { itemCount: Number(r.item_count) } : {}),
});

// withCounts: 이 효과를 쓰는 아이템 수도 함께 (관리 화면)
async function listEffects({ withCounts = false } = {}, conn = pool) {
  const [rows] = await conn.query(
    `SELECT e.code, e.label, e.example, e.description, e.sort_order
            ${withCounts ? ', (SELECT COUNT(*) FROM items i WHERE i.effect = e.code) AS item_count' : ''}
       FROM item_effects e ORDER BY e.sort_order, e.code`,
  );
  return rows.map(toEffect);
}

async function assertEffect(code, conn = pool) {
  const [rows] = await conn.execute('SELECT code FROM item_effects WHERE code = ?', [String(code ?? '')]);
  if (!rows[0]) throw new HttpError(400, '없는 아이템 효과입니다. 관리 → 아이템 효과에서 확인해주세요.');
}

// 입력 검증: { label, example, description, sortOrder }
function parseEffectInput(body) {
  const label = String(body?.label ?? '').trim();
  if (!label || label.length > 50) throw new HttpError(400, '효과 이름은 1~50자로 입력해주세요.');
  const exampleText = String(body?.example ?? '').trim() || '{}';
  let example;
  try { example = JSON.parse(exampleText); } catch { throw new HttpError(400, '효과수치 예시가 올바른 JSON 이 아닙니다.'); }
  if (example === null || typeof example !== 'object' || Array.isArray(example)) {
    throw new HttpError(400, '효과수치 예시는 {"키": 값} 형태의 JSON 객체여야 합니다.');
  }
  const exampleJson = JSON.stringify(example);
  if (exampleJson.length > 500) throw new HttpError(400, '효과수치 예시는 500자 이내로 입력해주세요.');
  const description = String(body?.description ?? '').trim();
  if (description.length > 255) throw new HttpError(400, '설명은 255자 이내로 입력해주세요.');
  const sortOrder = Number(body?.sortOrder ?? 0);
  if (!Number.isInteger(sortOrder) || Math.abs(sortOrder) > 100000) throw new HttpError(400, '순서는 정수로 입력해주세요.');
  return { label, example: exampleJson, description: description || null, sortOrder };
}

function parseCode(value) {
  const code = String(value ?? '').trim();
  if (!CODE_RE.test(code)) throw new HttpError(400, '코드는 영문 소문자로 시작하고 영문 소문자·숫자·_ 로 2~30자여야 합니다.');
  return code;
}

module.exports = { DEFAULT_EFFECT, listEffects, assertEffect, parseEffectInput, parseCode };
