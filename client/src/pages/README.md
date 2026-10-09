# 화면 구조 (pages / layouts / components)

SPA 구조입니다. HTML 파일은 `client/index.html` 하나뿐이고, 모든 화면은 Vue 컴포넌트로
`vue-router` 가 주소에 맞춰 바꿔 끼웁니다. (새로고침해도 Nginx 가 index.html 을 돌려줌)

```
src/
├─ App.vue            사이트 전체 틀 (상단 메뉴, 음악 플레이어)
├─ layouts/           여러 페이지가 같이 쓰는 큰 틀
│  ├─ AdminLayout.vue   관리 화면: 왼쪽 관리 메뉴 + <RouterView /> (router.js 에서 /admin 의 부모 라우트)
│  └─ ContentLayout.vue 콘텐츠 페이지: 제목 + 본문 — 페이지가 감싸서 씀
├─ pages/             주소 1개 = 파일 1개 (*Page.vue), 기능별 폴더
│  ├─ home/  auth/  mypage/  members/  shop/
│  ├─ board/          게시판 공용 (목록/글보기/글쓰기) — /qna 등 게시판 이름을 주소로 받아 동작
│  ├─ content/        공지·세계관 등 메뉴의 페이지 — ContentPage.vue 하나가 DB 내용을 불러와 ContentLayout 에 채움
│  └─ admin/          관리 페이지들 (AdminLayout 안에 들어감)
└─ components/        여러 페이지에서 쓰는 부품 (CharacterCard, ModalDialog, ProfileFormModal ...)
```

## 콘텐츠 페이지 (공지 / 세계관 / 시스템 / 캐릭터 가이드 / 직접 만든 페이지)
코드 없이 관리 화면에서 만듭니다. 내용은 DB(`content_pages.body`, 마크다운).
- **관리 → 페이지 관리**: 페이지 추가(주소 `/<영문>`)·삭제, 메뉴 이름·공개 여부·음악, 본문(마크다운) 하나
- **관리 → 메뉴 관리**: 상단 메뉴(와 홈 바로가기)에 보일 탭과 순서 (멤버·상점·Q&A 포함)
- 화면: `/<slug>` → `pages/content/ContentPage.vue` 가 불러와서 `layouts/ContentLayout.vue` 로 표시

## 새 기능 페이지 추가
1. `pages/<기능>/<이름>Page.vue` 생성
2. `src/router.js` 의 routes 에 한 줄: `{ path: '/<주소>', component: () => import('./pages/<기능>/<이름>Page.vue') }`
   - 관리 페이지면 `/admin` 의 `children` 에 추가 + `layouts/AdminLayout.vue` 메뉴에 한 줄
3. 메뉴에 보이게 하려면 `src/menu.js` 에 한 줄

`() => import(...)` 로 등록하면 **그 페이지에 들어갈 때만** 코드를 불러옵니다 (페이지가 늘어도 첫 로딩이 가벼움).

## 공통 틀(레이아웃) 만들기
layouts/ 는 여러 페이지가 같이 쓰는 **큰 틀**입니다. 쓰는 방법은 두 가지:

**① 감싸서 쓰기** (ContentLayout) — 페이지가 틀을 불러 내용을 슬롯에 채움. 틀이 데이터(제목)를 받아야 할 때
```vue
<ContentLayout :title="page.title">
  <MarkdownView :source="page.body" />
</ContentLayout>
```

**② 라우터 부모로 쓰기** (AdminLayout) — 틀 안의 `<RouterView />` 에 자식 페이지가 바뀌어 들어감. 메뉴 같은 틀이 그대로 남아야 할 때
```js
{ path: '/admin', component: () => import('./layouts/AdminLayout.vue'), meta: { requiresAdmin: true },
  children: [{ path: 'items', component: () => import('./pages/admin/ItemsPage.vue') }] }
```
부모의 `meta`(권한 검사 등)는 자식 모두에게 적용됩니다.

## 이 페이지에서만 음악 틀기
```vue
<script setup>
import { usePageMusic } from '../../music';
usePageMusic('유튜브영상ID');   // 이 페이지에 있는 동안만 재생 (자세한 건 src/music/README.md)
</script>
```
