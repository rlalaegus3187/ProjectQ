// 사이트 이름 / 아이콘 (관리 → 사이트 설정) — 상단 로고와 브라우저 탭(제목 + 아이콘)에 표시
//   import { site } from './site';   site.name, site.icon
import { reactive, watchEffect } from 'vue';

export const site = reactive({ name: 'ProjectQ', icon: null });

// 아이콘은 이모지(글자) 또는 업로드한 이미지 경로
export const isImageIcon = (icon) => typeof icon === 'string' && icon.startsWith('/api/uploads/');

// GET /api/settings 결과를 반영
export function setSite({ siteName, siteIcon }) {
  if (siteName) site.name = siteName;
  site.icon = siteIcon || null;
}

// 이모지 → 브라우저 탭 아이콘(SVG)
function faviconHref(icon) {
  if (!icon) return null;
  if (isImageIcon(icon)) return icon;
  const text = icon.replace(/[<>&"']/g, '');
  return `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text x="50" y="50" font-size="84" text-anchor="middle" dominant-baseline="central">${text}</text></svg>`,
  )}`;
}

// 값이 바뀌면 탭 제목·아이콘을 바로 바꿈
watchEffect(() => {
  document.title = site.name;
  let link = document.querySelector('link[rel="icon"]');
  const href = faviconHref(site.icon);
  if (!href) { link?.remove(); return; }
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
  }
  link.href = href;
});
