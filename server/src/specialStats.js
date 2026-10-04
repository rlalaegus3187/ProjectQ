// 특별 스탯 1~5 (characters.special1~5) — HP, MP, 이성 등
// 캐릭터 스탯(투자 포인트를 나눠 주는 적립형)과 달리 캐릭터마다 숫자를 그대로 입력
// 이름·사용 여부는 관리 → 캐릭터 항목에서 지정 (settings.special_stats JSON [{ name, enabled }] × 5)
const { getSetting, setSetting } = require('./settings');
const { HttpError } = require('./errors');

const SLOTS = [1, 2, 3, 4, 5];
const MAX_VALUE = 2147483647;
// 처음엔 1 = HP, 2 = MP 사용, 나머지는 여유분(미사용)
const DEFAULTS = [{ name: 'HP', enabled: true }, { name: 'MP', enabled: true }, ...Array(3).fill({ name: '', enabled: false })];

// [{ slot, name, enabled }] × 5
async function getSpecialStats(conn) {
  let saved = [];
  try { saved = JSON.parse((await getSetting('special_stats', conn)) || '[]'); } catch { saved = []; }
  return SLOTS.map((slot, i) => {
    const s = (Array.isArray(saved) && saved[i]) || DEFAULTS[i];
    return { slot, name: String(s.name ?? ''), enabled: !!s.enabled && !!String(s.name ?? '').trim() };
  });
}

// 사용 중인 것만 [{ slot, name }]
async function getEnabledSpecialStats(conn) {
  return (await getSpecialStats(conn)).filter((s) => s.enabled).map(({ slot, name }) => ({ slot, name }));
}

// 관리자 저장: [{ name, enabled }] × 5
async function saveSpecialStats(input) {
  if (!Array.isArray(input) || input.length !== SLOTS.length) throw new HttpError(400, '특별 스탯 5개를 보내주세요.');
  const list = input.map((s, i) => {
    const name = String(s?.name ?? '').trim();
    if (name.length > 20) throw new HttpError(400, `특별 스탯 ${i + 1}: 이름은 20자 이내로 입력해주세요.`);
    if (s?.enabled && !name) throw new HttpError(400, `특별 스탯 ${i + 1}: 사용하려면 이름을 입력해주세요.`);
    return { name, enabled: !!s?.enabled };
  });
  await setSetting('special_stats', JSON.stringify(list));
}

// 캐릭터 입력 검증: input = { 1: 100, 2: 50 } → 사용 중인 특별 스탯만 [{ slot, value }] (0 이상의 정수, 필수)
function validateSpecialValues(input, enabled) {
  return enabled.map(({ slot, name }) => {
    const text = String(input?.[slot] ?? '').trim();
    const value = Number(text);
    if (text === '' || !Number.isInteger(value) || value < 0 || value > MAX_VALUE) {
      throw new HttpError(400, `${name}은(는) 0 이상의 정수로 입력해주세요.`);
    }
    return { slot, value };
  });
}

// 캐릭터 행(special1~5) → 사용 중인 것만 [{ slot, name, value }]
const specialsOf = (row, enabled) => enabled.map(({ slot, name }) => ({ slot, name, value: row[`special${slot}`] ?? null }));

module.exports = { SLOTS, getSpecialStats, getEnabledSpecialStats, saveSpecialStats, validateSpecialValues, specialsOf };
