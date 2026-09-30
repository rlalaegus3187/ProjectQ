// 사이트 설정 (관리 → 사이트 설정) — 이름(상단 로고·탭 제목), 파비콘, 회원 전용 여부
//   import { site, loadSite } from './site';   site.name, site.favicon, site.private
import { reactive, watchEffect } from 'vue';
import { api } from './api';

export const site = reactive({ name: 'ProjectQ', favicon: null, private: false, music: null, loaded: false });

// GET /api/settings 결과를 반영
export function setSite({ siteName, siteFavicon, sitePrivate, siteMusic }) {
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
