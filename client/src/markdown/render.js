// 마크다운 → 안전한 HTML 변환 (스크립트·이벤트 속성·javascript: 링크 제거)
import { marked } from 'marked';
import DOMPurify from 'dompurify';

// 외부 링크는 새 탭으로 (모듈이 처음 불릴 때 한 번만 등록)
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
