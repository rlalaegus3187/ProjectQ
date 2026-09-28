// 유튜브 IFrame Player API 로더 + 링크 → 영상 ID
let apiPromise = null;

// https://developers.google.com/youtube/iframe_api_reference — 한 번만 불러옴
export function loadYouTubeApi() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (!apiPromise) {
    apiPromise = new Promise((resolve, reject) => {
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        if (typeof prev === 'function') prev();
        resolve(window.YT);
      };
      const script = document.createElement('script');
      script.src = 'https://www.youtube.com/iframe_api';
      script.async = true;
      script.onerror = () => {
        apiPromise = null;
        reject(new Error('유튜브 플레이어를 불러오지 못했습니다.'));
      };
      document.head.appendChild(script);
    });
  }
  return apiPromise;
}

const ID_RE = /^[A-Za-z0-9_-]{11}$/;
const HOSTS = ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtu.be', 'www.youtube-nocookie.com'];

// 링크 → 영상 ID (서버 youtube.js 와 같은 규칙). 유튜브가 아니면 null
export function parseYouTubeId(input) {
  const text = String(input ?? '').trim();
  if (!text) return null;
  if (ID_RE.test(text)) return text;
  let url;
  try { url = new URL(text); } catch { return null; }
  if (!HOSTS.includes(url.hostname)) return null;
  const id = url.hostname === 'youtu.be'
    ? url.pathname.split('/')[1]
    : url.searchParams.get('v') || url.pathname.match(/^\/(?:shorts|embed|live|v)\/([^/]+)/)?.[1];
  return id && ID_RE.test(id) ? id : null;
}

export const youtubeUrl = (id) => (id ? `https://www.youtube.com/watch?v=${id}` : '');
