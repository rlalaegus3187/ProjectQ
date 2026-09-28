# pages/ — 콘텐츠 페이지

SPA 구조입니다. HTML 파일은 `client/index.html` 하나뿐이고, 모든 페이지는 Vue 컴포넌트로
`vue-router` 가 주소에 맞춰 화면을 바꿔 끼웁니다. (새로고침해도 Nginx 가 index.html 을 돌려줌)

| 주소 | 파일 |
|---|---|
| `/notice` | `notice/NoticePage.vue` |
| `/world` | `world/WorldPage.vue` |
| `/system` | `system/SystemPage.vue` |
| `/guide` | `guide/GuidePage.vue` |

## 내용 채우기
각 폴더 안에 컴포넌트를 만들고 페이지의 `<PageContainer>` 안에 넣습니다.

```vue
<!-- pages/world/WorldPage.vue -->
<script setup>
import PageContainer from '../../components/PageContainer.vue';
import WorldMap from './WorldMap.vue';          // pages/world/WorldMap.vue
</script>

<template>
  <PageContainer title="세계관" description="ProjectQ 의 세계">
    <WorldMap />
  </PageContainer>
</template>
```

이미지 같은 파일은 `client/public/` 에 넣고 `/파일명` 으로 쓰거나, 컴포넌트 옆에 두고 `import` 합니다.

## 새 페이지 추가
1. `pages/<이름>/<이름>Page.vue` 생성 (위 페이지 복사)
2. `src/router.js` 의 routes 에 한 줄 추가: `{ path: '/<주소>', component: () => import('./pages/<이름>/<이름>Page.vue') }`
3. 메뉴에 보이게 하려면 `src/menu.js` 에 한 줄 추가

페이지는 `() => import(...)` 로 등록해서 **그 페이지에 들어갈 때만** 코드를 불러옵니다 (페이지가 늘어도 첫 로딩이 무거워지지 않음).
