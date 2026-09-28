import { api } from './api';

// 현재 활성화된 스탯/세부정보 항목 { stats: [], details: [] }
export async function fetchAttributes() {
  return api('/attributes');
}

// 폼 상태 만들기. character 가 있으면 기존 값으로 채움
export function toCharacterForm(definitions, character = null) {
  const valuesOf = (list) => Object.fromEntries((list || []).map((a) => [a.code, a.value ?? '']));
  const current = { stats: valuesOf(character?.stats), details: valuesOf(character?.details) };
  const fill = (defs, values) => Object.fromEntries(defs.map((d) => [d.code, values[d.code] ?? '']));
  return {
    name: character?.name ?? '',
    hp: character?.hp ?? '',
    stats: fill(definitions.stats, current.stats),
    details: fill(definitions.details, current.details),
  };
}
