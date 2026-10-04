// 사이트 설정 (관리 → 사이트 설정) — 이름(상단 로고·탭 제목), 파비콘, 회원 전용 여부, CSS 테마
//   import { site, loadSite } from './site';   site.name, site.favicon, site.private
import { reactive, watchEffect } from 'vue';
import { api } from './api';

export const site = reactive({
  name: 'ProjectQ', favicon: null, private: false, signupOpen: true, profileAddOpen: true, profileEditOpen: true, music: null, theme: { id: 'basic', css: null }, loaded: false,
});

// CSS 테마 적용: basic(/css/basic/style.css, index.html) 다음에 <link id="theme-css"> 로 테마 css 를 덮어씀
// css 가 null 이면 basic 만. remember: 다음 방문 때 바로 붙이도록 브라우저에 기억 (index.html 의 스크립트가 사용)
export function applyTheme(css, { remember = true } = {}) {
  let link = document.getElementById('theme-css');
  if (!css) {
    link?.remove();
  } else {
    if (!link) {
      link = document.createElement('link');
      link.rel = 'stylesheet';
      link.id = 'theme-css';
      document.head.appendChild(link);
    }
    if (link.getAttribute('href') !== css) link.setAttribute('href', css);
  }
  if (remember) {
    try { localStorage.setItem('pq-theme', JSON.stringify({ css: css || null })); } catch { /* 저장 못 해도 동작 */ }
  }
}

// GET /api/settings 결과를 반영
export function setSite({
  siteName, siteFavicon, sitePrivate, signupOpen, profileAddOpen, profileEditOpen, siteMusic, siteTheme,
}) {
  if (signupOpen !== undefined) site.signupOpen = !!signupOpen;
  if (profileAddOpen !== undefined) site.profileAddOpen = !!profileAddOpen;
  if (profileEditOpen !== undefined) site.profileEditOpen = !!profileEditOpen;
  if (siteTheme) {
    site.theme = siteTheme;
    applyTheme(siteTheme.css);
  }
  if (siteName) site.name = siteName;
  site.favicon = siteFavicon || null;
  if (sitePrivate !== undefined) site.private = !!sitePrivate;
  if (siteMusic !== undefined) site.music = siteMusic;
}

// 처음 한 번만 불러옴 (라우터 가드와 App 이 같이 기다림)
let loading = null;
export function loadSite() {
  if (!loading) {
    loading = api('/settings')
      .then((s) => { setSite(s); })
      .catch(() => { /* 못 불러와도 기본값으로 동작 */ })
      .finally(() => { site.loaded = true; });
  }
  return loading;
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
