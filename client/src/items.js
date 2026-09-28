// 아이템 효과 종류 (서버 inventory.js EFFECTS / DB ENUM 과 같아야 함)
export const EFFECTS = [
  { value: 'none', label: '효과 없음', example: '{}' },
  { value: 'hp_recover', label: 'HP 회복', example: '{"amount": 50}' },
  { value: 'stat_bonus', label: '스탯 증가', example: '{"str": 2, "int": 1}' },
  { value: 'custom', label: '기타', example: '{"note": "설명"}' },
];
export const effectLabel = (value) => EFFECTS.find((e) => e.value === value)?.label ?? value;

// 효과수치를 사람이 읽기 좋게: {"amount":50} → "amount 50"
export function formatEffectValues(values) {
  const entries = Object.entries(values || {});
  return entries.length ? entries.map(([k, v]) => `${k} ${typeof v === 'object' ? JSON.stringify(v) : v}`).join(', ') : '';
}
