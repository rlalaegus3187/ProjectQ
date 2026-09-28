// 유튜브 링크 → 영상 ID (11자). 유튜브가 아니거나 형식이 틀리면 400
//   https://www.youtube.com/watch?v=ID, https://youtu.be/ID, /shorts/ID, /embed/ID, /live/ID,
//   https://music.youtube.com/watch?v=ID, 또는 ID 자체
const { HttpError } = require('./errors');

const ID_RE = /^[A-Za-z0-9_-]{11}$/;
const HOSTS = ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtu.be', 'www.youtube-nocookie.com'];

function parseYouTubeId(input, label = '음악') {
  const text = String(input ?? '').trim();
  if (!text) return null;
  if (ID_RE.test(text)) return text;

  let url;
  try { url = new URL(text); } catch { throw new HttpError(400, `${label}: 유튜브 링크를 입력해주세요.`); }
  if (!['http:', 'https:'].includes(url.protocol) || !HOSTS.includes(url.hostname)) {
    throw new HttpError(400, `${label}: 유튜브 링크만 입력할 수 있습니다.`);
  }
  let id = null;
  if (url.hostname === 'youtu.be') {
    id = url.pathname.split('/')[1];
  } else if (url.searchParams.get('v')) {
    id = url.searchParams.get('v');
  } else {
    const m = url.pathname.match(/^\/(?:shorts|embed|live|v)\/([^/]+)/);
    id = m?.[1];
  }
  if (!id || !ID_RE.test(id)) throw new HttpError(400, `${label}: 유튜브 영상 링크가 올바르지 않습니다.`);
  return id;
}

const youtubeUrl = (id) => (id ? `https://www.youtube.com/watch?v=${id}` : null);

module.exports = { parseYouTubeId, youtubeUrl };
