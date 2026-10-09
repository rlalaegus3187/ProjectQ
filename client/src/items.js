import { reactive } from 'vue';
import { api } from './api';

// 아이템 효과 종류 — 관리 → 아이템 관리 → 아이템 효과에서 추가·삭제 (DB item_effects)
//   await loadItemEffects()  → [{ code, label, example, description }] (한 번 불러오면 재사용, force 로 다시)
//   effectLabel('hp_recover') → 'HP 회복'
export const itemEffects = reactive({ list: [], loaded: false });
export async function loadItemEffects({ force = false } = {}) {
  if (!itemEffects.loaded || force) {
    itemEffects.list = (await api('/item-effects')).effects;
    itemEffects.loaded = true;
  }
  return itemEffects.list;
}
export const effectLabel = (code) => itemEffects.list.find((e) => e.code === code)?.label ?? code;

// 효과수치를 사람이 읽기 좋게: {"amount":50} → "amount 50"
export function formatEffectValues(values) {
  const entries = Object.entries(values || {});
  return entries.length ? entries.map(([k, v]) => `${k} ${typeof v === 'object' ? JSON.stringify(v) : v}`).join(', ') : '';
}

// 소지금 표시: 12345 → "12,345"
export const formatMoney = (n) => Number(n ?? 0).toLocaleString('ko-KR');

// 아이템 습득/사용 기록의 획득처·사유 (서버 item_logs.source) — 새 획득처를 만들면 여기에 이름 추가
const ITEM_SOURCES = {
  admin: '관리자 지급',
  shop: '상점 구매',
  admin_take: '관리자 회수',
  discard: '버림',
  legacy: '이전부터 보유',
  system: '시스템',
};
export const itemSourceLabel = (source) => ITEM_SOURCES[source] ?? source;

// 소지금 내역 사유
const MONEY_REASONS = { admin: '관리자', shop_buy: '상점 구매' };
export const moneyReasonLabel = (reason) => MONEY_REASONS[reason] ?? reason;
