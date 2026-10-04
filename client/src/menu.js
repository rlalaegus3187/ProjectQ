// 상단 메뉴 / 홈 화면 바로가기 — 관리 → 메뉴 관리에서 고른 항목이 순서대로 (GET /api/menu)
//   항목: 콘텐츠 페이지(공지·세계관 등, 관리 → 페이지 관리에서 추가) + 멤버 / 상점 / Q&A
import { reactive } from 'vue';
import { api } from './api';
import { isAdmin } from './auth';

// items: [{ key, label, to, isPublic? }]
export const siteMenu = reactive({ loaded: false, items: [] });

export async function loadMenu() {
  try {
    siteMenu.items = (await api('/menu')).menu;
  } catch {
    siteMenu.items = [];   // 회원 전용 모드에서 로그인 전 등
  }
  siteMenu.loaded = true;
}

// 비공개 페이지는 관리자에게 🔒 표시 (메뉴에는 그대로 보이고, 들어가면 '비공개 페이지입니다')
export const menuLabel = (m) => (m.isPublic === false && isAdmin() ? `${m.label} 🔒` : m.label);
