// 마크다운 → 안전한 HTML 변환 (스크립트·이벤트 속성·javascript: 링크·style 속성 제거)
import { marked, Marked } from 'marked';
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

export function renderMarkdown(source) {
  // breaks: 엔터 한 번도 줄바꿈으로 (일반 텍스트처럼 쓴 글도 자연스럽게 보이도록)
  // style 속성은 지움 — 글에 넣은 CSS 로 화면을 덮거나 외부 주소를 불러오지 못하게
  return DOMPurify.sanitize(marked.parse(String(source ?? ''), { breaks: true, gfm: true }), { FORBID_ATTR: ['style'] });
}

// 채팅 메시지용 — 글자 꾸미기만 (이미지·표·style 없음, 링크는 됨)
//   **굵게**  *기울임*  ~~취소선~~  ==형광펜==  `코드`  # 크게  ## 조금 크게  -# 작게  > 인용  - 목록
const chatMarked = new Marked({ breaks: true, gfm: true });
chatMarked.use({
  extensions: [
    {   // -# 작게 (한 줄)
      name: 'chatSmall',
      level: 'block',
      start: (src) => src.match(/^-# /m)?.index,
      tokenizer(src) {
        const m = /^-# +([^\n]+)(?:\n|$)/.exec(src);
        if (m) return { type: 'chatSmall', raw: m[0], tokens: this.lexer.inlineTokens(m[1]) };
        return undefined;
      },
      renderer(token) { return `<p><small>${this.parser.parseInline(token.tokens)}</small></p>`; },
    },
    {   // ==형광펜==
      name: 'chatMark',
      level: 'inline',
      start: (src) => src.indexOf('=='),
      tokenizer(src) {
        const m = /^==([^=\n]+)==/.exec(src);
        if (m) return { type: 'chatMark', raw: m[0], tokens: this.lexer.inlineTokens(m[1]) };
        return undefined;
      },
      renderer(token) { return `<mark>${this.parser.parseInline(token.tokens)}</mark>`; },
    },
  ],
});
const CHAT_TAGS = ['p', 'br', 'strong', 'b', 'em', 'i', 'del', 's', 'mark', 'small', 'code', 'pre', 'h1', 'h2', 'h3', 'blockquote', 'ul', 'ol', 'li', 'a'];
export function renderChat(source) {
  const html = chatMarked.parse(String(source ?? '')).replace(/<(\/?)h[4-6]>/g, '<$1h3>');   // 제목은 3단계까지
  return DOMPurify.sanitize(html, { ALLOWED_TAGS: CHAT_TAGS, ALLOWED_ATTR: ['href', 'target', 'rel'] });
}
