// 코스트 1~5 (HP, MP, 이성 등) — 캐릭터마다 현재치 / 최대치를 기록 (characters.costN_current / costN_max)
// 캐릭터 스탯(투자 포인트를 나눠 주는 적립형)과 달리 숫자를 그대로 입력
// 이름·사용 여부는 관리 → 캐릭터 항목에서 지정 (settings.costs JSON [{ name, enabled }] × 5)
const { getSetting, setSetting } = require('./settings');
const { HttpError } = require('./errors');

const SLOTS = [1, 2, 3, 4, 5];
const MAX_VALUE = 2147483647;
// 처음엔 1 = HP, 2 = MP 사용, 나머지는 여유분(미사용)
const DEFAULTS = [{ name: 'HP', enabled: true }, { name: 'MP', enabled: true }, ...Array(3).fill({ name: '', enabled: false })];

// [{ slot, name, enabled }] × 5
async function getCosts(conn) {
  let saved = [];
  try { saved = JSON.parse((await getSetting('costs', conn)) || '[]'); } catch { saved = []; }
  return SLOTS.map((slot, i) => {
    const s = (Array.isArray(saved) && saved[i]) || DEFAULTS[i];
    return { slot, name: String(s.name ?? ''), enabled: !!s.enabled && !!String(s.name ?? '').trim() };
  });
}

// 사용 중인 것만 [{ slot, name }]
async function getEnabledCosts(conn) {
  return (await getCosts(conn)).filter((s) => s.enabled).map(({ slot, name }) => ({ slot, name }));
}

// 관리자 저장: [{ name, enabled }] × 5
async function saveCosts(input) {
  if (!Array.isArray(input) || input.length !== SLOTS.length) throw new HttpError(400, '코스트 5개를 보내주세요.');
  const list = input.map((s, i) => {
    const name = String(s?.name ?? '').trim();
    if (name.length > 20) throw new HttpError(400, `코스트 ${i + 1}: 이름은 20자 이내로 입력해주세요.`);
    if (s?.enabled && !name) throw new HttpError(400, `코스트 ${i + 1}: 사용하려면 이름을 입력해주세요.`);
    return { name, enabled: !!s?.enabled };
  });
  await setSetting('costs', JSON.stringify(list));
}

function parseValue(raw, label) {
  const text = String(raw ?? '').trim();
  const value = Number(text);
  if (text === '' || !Number.isInteger(value) || value < 0 || value > MAX_VALUE) {
    throw new HttpError(400, `${label}은(는) 0 이상의 정수로 입력해주세요.`);
  }
  return value;
}

// 캐릭터 입력 검증: input = { 1: { current, max }, ... } → 사용 중인 코스트만 [{ slot, current, max }]
// 현재치는 최대치를 넘을 수 없음
function validateCostValues(input, enabled) {
  return enabled.map(({ slot, name }) => {
    const max = parseValue(input?.[slot]?.max, `${name} 최대치`);
    const current = parseValue(input?.[slot]?.current, `${name} 현재치`);
    if (current > max) throw new HttpError(400, `${name}: 현재치(${current})가 최대치(${max})보다 클 수 없습니다.`);
    return { slot, current, max };
  });
}

// 캐릭터 행 → 사용 중인 것만 [{ slot, name, current, max }]
const costsOf = (row, enabled) => enabled.map(({ slot, name }) => ({
  slot, name, current: row[`cost${slot}_current`] ?? null, max: row[`cost${slot}_max`] ?? null,
}));

// SELECT 에 넣을 칼럼 목록 (c.cost1_current, c.cost1_max, ...)
const COST_COLUMNS = SLOTS.map((n) => `c.cost${n}_current, c.cost${n}_max`).join(', ');

module.exports = { SLOTS, COST_COLUMNS, getCosts, getEnabledCosts, saveCosts, validateCostValues, costsOf };
