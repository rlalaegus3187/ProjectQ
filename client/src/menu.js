// 상단 메뉴 / 홈 화면 바로가기 목록 — 페이지를 추가하면 여기와 router.js 에 한 줄씩 추가
// slug 가 있는 항목 = 콘텐츠 페이지: 관리 → 페이지 관리에서 바꾼 제목이 메뉴 이름이 됨 (label 은 불러오기 전 기본값)
import { contentTitles, contentMenu } from './contents';

export const SITE_MENU = [
  { to: '/notice', slug: 'notice', label: '공지' },
  { to: '/world', slug: 'world', label: '세계관' },
  { to: '/system', slug: 'system', label: '시스템' },
  { to: '/guide', slug: 'guide', label: '캐릭터 가이드' },
  { to: '/members', label: '멤버' },
  { to: '/shop', label: '상점' },
  { to: '/qna', label: 'Q&A' },
];

export const menuLabel = (m) => {
  const label = (m.slug && contentTitles[m.slug]) || m.label;
  return m.slug && contentMenu.private[m.slug] ? `${label} 🔒` : label;   // 비공개 페이지 (관리자에게만 보임)
};

// 지금 보여줄 메뉴: 비공개 콘텐츠 페이지는 관리자 말고는 빠짐 (불러오기 전에는 콘텐츠 페이지를 잠시 숨김)
export const visibleMenu = () => SITE_MENU.filter((m) => !m.slug || (contentMenu.loaded && contentMenu.visible[m.slug]));
