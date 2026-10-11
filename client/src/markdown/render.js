// 마크다운 → 안전한 HTML 변환 (스크립트·이벤트 속성·javascript: 링크·style 속성 제거)
import { marked } from 'marked';
import DOMPurify from 'dompurify';

// 외부 링크는 새 탭으로 (모듈이 처음 불릴 때 한 번만 등록)
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A' && /^https?:\/\//i.test(node.getAttribute('href') || '')) {
    node.setAttribute('target', '_blank');
    node.setAttribute('rel', 'noopener noreferrer');
  }
  // 바깥 이미지 링크: 이 사이트 주소를 알리지 않음 (다른 사이트 그림 사용을 막는 곳에서도 보이도록), 화면에 가까워지면 불러옴
  if (node.tagName === 'IMG') {
    node.setAttribute('referrerpolicy', 'no-referrer');
    node.setAttribute('loading', 'lazy');
  }
});

// 사이트 공통 문법 추가 (글·페이지·프로필·채팅 모두 같음 — 툴바는 MarkdownToolbar.vue)
//   ==형광펜==   ·   줄 앞에 '-# ' → 작은 글씨
marked.use({
  extensions: [
    {
      name: 'smallLine',
      level: 'block',
      start: (src) => src.match(/^-# /m)?.index,
      tokenizer(src) {
        const m = /^-# +([^\n]+)(?:\n|$)/.exec(src);
        if (m) return { type: 'smallLine', raw: m[0], tokens: this.lexer.inlineTokens(m[1]) };
        return undefined;
      },
      renderer(token) { return `<p><small>${this.parser.parseInline(token.tokens)}</small></p>\n`; },
    },
    {
      name: 'highlight',
      level: 'inline',
      start: (src) => src.indexOf('=='),
      tokenizer(src) {
        const m = /^==([^=\n]+)==/.exec(src);
        if (m) return { type: 'highlight', raw: m[0], tokens: this.lexer.inlineTokens(m[1]) };
        return undefined;
      },
      renderer(token) { return `<mark>${this.parser.parseInline(token.tokens)}</mark>`; },
    },
  ],
});

export function renderMarkdown(source) {
  // breaks: 엔터 한 번도 줄바꿈으로 (일반 텍스트처럼 쓴 글도 자연스럽게 보이도록)
  // style 속성은 지움 — 글에 넣은 CSS 로 화면을 덮거나 외부 주소를 불러오지 못하게
  return DOMPurify.sanitize(marked.parse(String(source ?? ''), { breaks: true, gfm: true }), { FORBID_ATTR: ['style'] });
}

