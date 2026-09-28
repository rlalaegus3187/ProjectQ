# markdown/ — 마크다운 모듈

긴 글(Q&A 게시글·답변, 프로필의 "긴 텍스트" 항목)을 쓰고 보여주는 공용 모듈입니다.

```js
import { renderMarkdown, MarkdownEditor, MarkdownView } from '../markdown';
```

| 이름 | 용도 |
|---|---|
| `<MarkdownEditor v-model="text" />` | 편집기 — 툴바(제목·굵게·기울임·목록·링크), **이미지 넣기**(업로드 후 본문에 삽입), **미리보기** |
| `<MarkdownView :source="text" />` | 표시 |
| `renderMarkdown(text)` | 마크다운 → 안전한 HTML 문자열 (직접 `v-html` 에 넣을 때) |

`MarkdownEditor` props: `rows`(기본 10), `maxlength`(기본 50000), `placeholder`, `id`(label 연결)

## 문법 (툴바 버튼과 같음)
```
## 소제목
**굵게**  *기울임*
- 목록
[링크 글자](https://example.com)
![이미지 설명](/api/uploads/xxxx.png)
```
엔터 한 번도 줄바꿈으로 표시됩니다. 외부 링크는 새 탭으로 열립니다.

## 보안
사용자가 쓴 글이 HTML 로 바뀌므로 `renderMarkdown` 이 DOMPurify 로 `<script>`, `onerror` 같은 이벤트 속성,
`javascript:` 링크를 제거합니다. **`v-html` 에는 반드시 `renderMarkdown` 결과(또는 `MarkdownView`)만** 넣으세요.

## 사용 중인 곳
- `components/PostEditor.vue` — Q&A 글쓰기/답변
- `components/AttributeInput.vue` / `AttributeValue.vue` — 프로필 "긴 텍스트" 항목 입력/표시
- `views/PostDetailView.vue` — Q&A 글/답변 표시
