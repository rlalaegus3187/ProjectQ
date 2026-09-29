// 사이트 이름 / 파비콘 (관리 → 사이트 설정) — 상단 로고, 브라우저 탭 제목·아이콘에 표시
//   import { site } from './site';   site.name, site.favicon
import { reactive, watchEffect } from 'vue';

export const site = reactive({ name: 'ProjectQ', favicon: null });

// GET /api/settings 결과를 반영
export function setSite({ siteName, siteFavicon }) {
  if (siteName) site.name = siteName;
  site.favicon = siteFavicon || null;
}

// 값이 바뀌면 탭 제목·아이콘을 바로 바꿈
watchEffect(() => {
  document.title = site.name;
  let link = document.querySelector('link[rel="icon"]');
  if (!site.favicon) { link?.remove(); return; }
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
  }
  link.href = site.favicon;
});
