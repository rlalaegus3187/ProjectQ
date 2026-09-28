// 마크다운 모듈 — 어디서든 이 폴더만 import 해서 사용
//
//   import { renderMarkdown, MarkdownEditor, MarkdownView } from '../markdown';
//
//   renderMarkdown('## 제목\n**굵게**')   → '<h2>제목</h2>\n<p><strong>굵게</strong></p>' (안전한 HTML)
//   <MarkdownEditor v-model="text" />      편집 (툴바, 이미지 넣기, 미리보기)
//   <MarkdownView :source="text" />        표시
//
// 사용자가 쓴 글이 HTML 이 되므로, v-html 에는 반드시 renderMarkdown 결과(또는 MarkdownView)만 쓰세요.
export { renderMarkdown } from './render';
export { default as MarkdownEditor } from './MarkdownEditor.vue';
export { default as MarkdownView } from './MarkdownView.vue';
