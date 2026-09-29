// 마크다운 → 안전한 HTML 변환 (스크립트·이벤트 속성·javascript: 링크 제거)
//
// 글자 꾸미기는 HTML 태그로 씁니다 (편집기 툴바가 넣어줌):
//   <span style="color: #e11d48">빨간 글자</span>
//   <span style="background-color: #fef08a">형광펜</span>
//   <span style="font-size: 1.5em">큰 글자</span>
//   <div style="text-align: center">          ← 가운데 정렬 (안쪽 위아래로 빈 줄을 두면 마크다운도 적용)
//
//   </div>
// style 속성은 아래 STYLE_RULES 에 있는 속성·값만 남기고 나머지는 지움
// (position, background-image 같은 걸로 화면을 덮거나 외부 주소를 불러오는 것 방지)
import { marked } from 'marked';
import DOMPurify from 'dompurify';

// #f00, #ff0000 또는 이름(red, navy ...). url(...), var(...) 같은 건 통과 못 함
const COLOR = /^(?:#(?:[0-9a-f]{3}|[0-9a-f]{6})|[a-z]{3,20})$/;

function isFontSize(value) {
  const m = value.match(/^(\d+(?:\.\d+)?)(em|rem|px|%)$/);
  if (!m) return false;
  const n = Number(m[1]);
  const [min, max] = { em: [0.5, 3], rem: [0.5, 3], px: [8, 48], '%': [50, 300] }[m[2]];
  return n >= min && n <= max;
}

export const STYLE_RULES = {
  color: (v) => COLOR.test(v),
  'background-color': (v) => COLOR.test(v),
  'font-size': isFontSize,
  'text-align': (v) => ['left', 'center', 'right'].includes(v),
};

// 'color: #F00; position: fixed' → 'color: #f00'
export function cleanStyle(style) {
  const kept = [];
  for (const decl of String(style).split(';')) {
    const i = decl.indexOf(':');
    if (i < 0) continue;
    const prop = decl.slice(0, i).trim().toLowerCase();
    const value = decl.slice(i + 1).trim().toLowerCase();
    if (STYLE_RULES[prop]?.(value)) kept.push(`${prop}: ${value}`);
  }
  return kept.join('; ');
}

// 훅은 모듈이 처음 불릴 때 한 번만 등록
DOMPurify.addHook('uponSanitizeAttribute', (node, data) => {
  if (data.attrName !== 'style') return;
  const style = cleanStyle(data.attrValue);
  if (style) data.attrValue = style;
  else data.keepAttr = false;
});

// 외부 링크는 새 탭으로
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A' && /^https?:\/\//i.test(node.getAttribute('href') || '')) {
    node.setAttribute('target', '_blank');
    node.setAttribute('rel', 'noopener noreferrer');
  }
});

export function renderMarkdown(source) {
  // breaks: 엔터 한 번도 줄바꿈으로 (일반 텍스트처럼 쓴 글도 자연스럽게 보이도록)
  return DOMPurify.sanitize(marked.parse(String(source ?? ''), { breaks: true, gfm: true }));
}
