# markdown/ — 마크다운 모듈

긴 글(Q&A 게시글·답변, 프로필의 "긴 텍스트" 항목, 공지·세계관 등 콘텐츠 페이지)과 **채팅 메시지**를 쓰고 보여주는 공용 모듈입니다.
**문법·툴바·표시가 사이트 전체에서 하나**입니다 (채팅도 같은 툴바·같은 모양, 크기만 작게).

```js
import { renderMarkdown, MarkdownEditor, MarkdownView, MarkdownToolbar } from '../markdown';
```

| 이름 | 용도 |
|---|---|
| `<MarkdownEditor v-model="text" />` | 편집기 — 공통 툴바 + 입력칸 |
| `<MarkdownToolbar v-model="text" :target="textarea" />` | 공통 툴바만 — 제목·굵게·기울임·취소선·형광펜·작게·목록·인용·코드·링크·**이미지 넣기**(업로드)·**이미지 링크** (채팅 입력칸은 `compact`) |
| `<MarkdownView :source="text" />` | 표시 |
| `renderMarkdown(text)` | 마크다운 → 안전한 HTML 문자열 (직접 `v-html` 에 넣을 때) |

`MarkdownEditor` props: `rows`(기본 10), `maxlength`(기본 50000), `placeholder`, `id`(label 연결)

## 문법 (툴바 버튼과 같음)
```
## 소제목
**굵게**  *기울임*  ~~취소선~~  ==형광펜==  `코드`
-# 작은 글씨
> 인용
- 목록
[링크 글자](https://example.com)
![이미지 설명](/api/uploads/xxxx.png)   또는   ![이미지](https://.../a.png)
```
엔터 한 번도 줄바꿈으로 표시됩니다. 외부 링크는 새 탭으로 열립니다.


## 보안
사용자가 쓴 글이 HTML 로 바뀌므로 `renderMarkdown` 이 DOMPurify 로 `<script>`, `onerror` 같은 이벤트 속성,
`javascript:` 링크를 제거하고, `style` 속성도 지웁니다(화면을 덮거나 외부 주소를 불러오는 CSS 차단). **`v-html` 에는 반드시 `renderMarkdown` 결과(또는 `MarkdownView`)만** 넣으세요.

## 사용 중인 곳
- `pages/chat/ChatPage.vue` · `chat/ChatMessage.vue` — 채팅 입력칸 툴바 / 메시지 표시
- `components/PostEditor.vue` — Q&A 글쓰기/답변
- `components/AttributeInput.vue` / `AttributeValue.vue` — 프로필 "긴 텍스트" 항목 입력/표시
- `pages/board/PostDetailPage.vue` — Q&A 글/답변 표시
- `pages/content/ContentPage.vue` / `pages/admin/ContentEditPage.vue` — 콘텐츠 페이지 표시/작성
