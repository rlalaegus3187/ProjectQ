// 화면별 CSS 불러오기 — /css/basic/style.css(공통)는 index.html 이 항상 불러오고,
// 그 밖의 css 는 router.js 의 meta 로 정한 화면에 있을 때만 <head> 에 붙임 (다른 화면으로 가면 뺌)
//
//   meta: { layoutCss: 'admin' }   → /css/basic/admin.css          (관리 화면 전체 — /admin 부모 라우트에)
//   meta: { css: 'MyPage' }        → /css/basic/pages/MyPage.css   (그 페이지만)
//
// 순서: style.css → admin.css → pages/*.css → 테마(theme-css, 맨 뒤라 모두 덮어씀)
// 새 css 를 다 받은 뒤에 화면이 바뀌므로 모양이 깨졌다 돌아오는 깜빡임이 없음
const BASE = '/css/basic/';
// 배포할 때마다 바뀌는 값 → 파일을 고쳐 배포하면 브라우저도 새 파일을 받음 (vite.config.js)
// eslint-disable-next-line no-undef
const VERSION = typeof __CSS_VERSION__ !== 'undefined' ? __CSS_VERSION__ : '';
const LOAD_TIMEOUT = 3000;

// 이 라우트에 필요한 css 파일 (부모 라우트 것까지)
export function cssFilesFor(route) {
  const files = [];
  for (const r of route.matched) {
    if (r.meta.layoutCss) files.push(`${r.meta.layoutCss}.css`);
    if (r.meta.css) files.push(`pages/${r.meta.css}.css`);
  }
  return [...new Set(files)];
}

const pageLinks = () => [...document.querySelectorAll('link[data-page-css]')];

// 아직 없는 파일만 붙이고, 다 받을 때까지 기다림 (없는 파일·느린 응답이어도 화면은 넘어감) → 돌려주는 값 없음
export async function loadCss(files) {
  const have = new Set(pageLinks().map((l) => l.dataset.pageCss));
  const theme = document.getElementById('theme-css');
  const waits = files.filter((f) => !have.has(f)).map((file) => new Promise((resolve) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = `${BASE}${file}${VERSION ? `?v=${VERSION}` : ''}`;
    link.dataset.pageCss = file;
    link.onload = resolve;
    link.onerror = resolve;
    setTimeout(resolve, LOAD_TIMEOUT);
    document.head.insertBefore(link, theme);   // 테마보다 앞 (theme 이 없으면 맨 뒤)
  }));
  await Promise.all(waits);
}

// 지금 화면에 필요 없는 css 빼기
export function dropCssExcept(files) {
  const keep = new Set(files);
  for (const link of pageLinks()) if (!keep.has(link.dataset.pageCss)) link.remove();
}
