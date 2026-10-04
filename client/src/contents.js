// 콘텐츠 페이지 (공지 / 세계관 / 시스템 / 캐릭터 가이드) — 내용은 DB(content_pages)
// 관리 → 페이지 관리에서 작성, 화면은 pages/content/ContentPage.vue 하나가 표시
import { reactive } from 'vue';
import { api } from './api';

// 주소로 쓰는 slug (DB 의 content_pages.slug 와 같아야 함). 새 페이지는 DB 에 행 추가 + 여기 + menu.js
export const CONTENT_SLUGS = ['notice', 'world', 'system', 'guide'];

// 메뉴에 보일 제목 (관리자가 제목을 바꾸면 메뉴에도 반영)
export const contentTitles = reactive({});
// 메뉴에 보일 페이지: 비공개 페이지는 관리자에게만 내려옴 → 목록에 없는 slug 는 메뉴에서 숨김
// { loaded, visible: { slug: true }, private: { slug: true } }
export const contentMenu = reactive({ loaded: false, visible: {}, private: {} });

export async function loadContentTitles() {
  const { pages } = await api('/contents');
  contentMenu.visible = {};
  contentMenu.private = {};
  for (const p of pages) {
    contentTitles[p.slug] = p.title;
    contentMenu.visible[p.slug] = true;
    if (!p.isPublic) contentMenu.private[p.slug] = true;
  }
  contentMenu.loaded = true;
}
