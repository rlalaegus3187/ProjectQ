# 화면 구조 (pages / layouts / components)

SPA 구조입니다. HTML 파일은 `client/index.html` 하나뿐이고, 모든 화면은 Vue 컴포넌트로
`vue-router` 가 주소에 맞춰 바꿔 끼웁니다. (새로고침해도 Nginx 가 index.html 을 돌려줌)

```
src/
├─ App.vue            사이트 전체 틀 (상단 메뉴, 음악 플레이어)
├─ layouts/           여러 페이지가 같이 쓰는 바깥 틀 — 안에 <RouterView /> 자리가 있고 자식 페이지가 들어감
│  └─ AdminLayout.vue   관리 메뉴 (관리 페이지 전체 공통)
├─ pages/             주소 1개 = 파일 1개 (*Page.vue), 기능별 폴더
│  ├─ home/  auth/  mypage/  members/  shop/
│  ├─ board/          게시판 공용 (목록/글보기/글쓰기) — /qna 등 게시판 이름을 주소로 받아 동작
│  ├─ content/        공지·세계관·시스템·캐릭터 가이드 — ContentPage.vue 하나가 DB 내용을 표시
│  └─ admin/          관리 페이지들 (AdminLayout 안에 들어감)
└─ components/        여러 페이지에서 쓰는 부품 (CharacterCard, ModalDialog, PageContainer ...)
```

## 공지 / 세계관 / 시스템 / 캐릭터 가이드
페이지 파일을 따로 두지 않습니다. 내용은 DB(`content_pages`)에 있고 **관리 → 페이지 관리**에서
마크다운으로 작성하면 `/notice`, `/world`, `/system`, `/guide` 에 바로 보입니다.
페이지마다 음악(유튜브)도 지정할 수 있습니다.

콘텐츠 페이지를 하나 더 늘리려면:
1. DB: `INSERT INTO content_pages (slug, title, sort_order) VALUES ('event', '이벤트', 50);` (마이그레이션 파일로)
2. `src/contents.js` 의 `CONTENT_SLUGS` 에 `'event'` 추가
3. 메뉴에 보이게 하려면 `src/menu.js` 에 `{ to: '/event', slug: 'event', label: '이벤트' }` 추가

## 새 기능 페이지 추가
1. `pages/<기능>/<이름>Page.vue` 생성
2. `src/router.js` 의 routes 에 한 줄: `{ path: '/<주소>', component: () => import('./pages/<기능>/<이름>Page.vue') }`
   - 관리 페이지면 `/admin` 의 `children` 에 추가 + `layouts/AdminLayout.vue` 메뉴에 한 줄
3. 메뉴에 보이게 하려면 `src/menu.js` 에 한 줄

`() => import(...)` 로 등록하면 **그 페이지에 들어갈 때만** 코드를 불러옵니다 (페이지가 늘어도 첫 로딩이 가벼움).

## 공통 틀(레이아웃) 만들기
여러 페이지가 같은 바깥 모양을 쓰면 `layouts/` 에 틀을 만들고 라우터에서 자식으로 묶습니다.
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
