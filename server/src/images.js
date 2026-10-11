// 이미지 값 검사 공용 — 이미지 칸은 두 가지를 받음
//   1) 이 사이트에 올린 파일  /api/uploads/<32자리>.png  (ImageField 의 '파일 올리기')
//   2) 바깥 이미지 링크       https://... 또는 http://...   (ImageField 의 '링크로 등록')
//
//   const { parseImageUrl } = require('../images');
//   const image = parseImageUrl(body.image, { label: '배너 이미지', required: true });   // 빈 값이면 null (required 면 오류)
//
// 링크는 그 주소의 그림을 그대로 보여주므로, 원래 사이트에서 지우거나 막으면 여기서도 안 보입니다.
const { HttpError } = require('./errors');

const UPLOAD_RE = /^\/api\/uploads\/[a-f0-9]{32}\.(png|jpg|gif|webp)$/;
const UPLOAD_ICO_RE = /^\/api\/uploads\/[a-f0-9]{32}\.(ico|png|jpg|gif|webp)$/;
const MAX_LINK = 1000;

const isUploaded = (value, { ico = false } = {}) => (ico ? UPLOAD_ICO_RE : UPLOAD_RE).test(String(value ?? ''));

// 바깥 이미지 링크인지 (http/https 만, 공백·따옴표 없이)
function isImageLink(value) {
  const text = String(value ?? '');
  if (!text || text.length > MAX_LINK || /[\s"'<>]/.test(text)) return false;
  try {
    const u = new URL(text);
    return (u.protocol === 'http:' || u.protocol === 'https:') && !!u.hostname;
  } catch {
    return false;
  }
}

function parseImageUrl(value, { label = '이미지', required = false, ico = false } = {}) {
  const text = String(value ?? '').trim();
  if (!text) {
    if (required) throw new HttpError(400, `${label}를 올리거나 링크를 넣어주세요.`);
    return null;
  }
  if (isUploaded(text, { ico }) || isImageLink(text)) return text;
  throw new HttpError(400, `${label}: 파일을 다시 올리거나 http(s):// 로 시작하는 이미지 링크를 넣어주세요.`);
}

module.exports = { MAX_LINK, isUploaded, isImageLink, parseImageUrl };
