import { api } from './api';

// 항목 형식 (캐릭터 스탯 / 프로필 양식 공통)
export const VALUE_TYPES = [
  { value: 'number', label: '숫자' },
  { value: 'text', label: '짧은 텍스트' },
  { value: 'long_text', label: '긴 텍스트' },
  { value: 'link', label: '링크' },
  { value: 'image', label: '이미지' },
  { value: 'select', label: '드롭다운' },
];
export const typeLabel = (type) => VALUE_TYPES.find((t) => t.value === type)?.label ?? type;

// 숫자형 캐릭터 스탯 = 투자 포인트를 나눠 주는 스탯 (서버 isPointStat 과 동일 규칙)
export const isPointStat = (def) => def.category === 'stat' && def.valueType === 'number';

// 현재 활성화된 항목 { stats: [], details: [] }
export async function fetchAttributes() {
  return api('/attributes');
}

// 이미지 업로드 → 저장할 경로(url) 반환
export async function uploadImage(file) {
  const body = new FormData();
  body.append('file', file);
  const { url } = await api('/uploads', { method: 'POST', body });
  return url;
}

// 폼 상태 만들기. character 가 있으면 기존 값으로 채움
export function toCharacterForm(definitions, character = null) {
  const valuesOf = (list) => Object.fromEntries((list || []).map((a) => [a.code, a.value ?? '']));
  const current = { stats: valuesOf(character?.stats), details: valuesOf(character?.details) };
  // 투자 포인트 스탯은 빈칸 대신 0 에서 시작
  const fill = (defs, values) => Object.fromEntries(
    defs.map((d) => [d.code, values[d.code] || (isPointStat(d) ? 0 : '')]),
  );
  return {
    name: character?.name ?? '',
    hp: character?.hp ?? '',
    stats: fill(definitions.stats, current.stats),
    details: fill(definitions.details, current.details),
  };
}
