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

const valuesOf = (list) => Object.fromEntries((list || []).map((a) => [a.code, a.value ?? '']));
// 투자 포인트 스탯은 빈칸 대신 0 에서 시작
const fill = (defs, values) => Object.fromEntries(
  defs.map((d) => [d.code, values[d.code] || (isPointStat(d) ? 0 : '')]),
);

// 캐릭터 폼 (기본정보 + 스탯 [+ 첫 프로필]). character 가 있으면 기존 값으로 채움
// 새 캐릭터(회원가입/캐릭터 만들기)일 때는 첫 프로필(profileName, details)도 함께 입력
export function toCharacterForm(definitions, character = null) {
  return {
    name: character?.name ?? '',
    hp: character?.hp ?? '',
    stats: fill(definitions.stats, valuesOf(character?.stats)),
    profileName: '',
    details: fill(definitions.details, {}),
  };
}

// 프로필 폼 { name, details }. profile 이 있으면 기존 값으로 채움
export function toProfileForm(definitions, profile = null) {
  return {
    name: profile?.name ?? '',
    details: fill(definitions.details, valuesOf(profile?.details)),
  };
}
