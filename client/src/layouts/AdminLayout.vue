<script setup>
// 관리 페이지 공통 틀: 왼쪽 메뉴 + 오른쪽에 고른 관리 페이지(pages/admin/*)
// router.js 에서 /admin 아래 자식 라우트로 등록 → 메뉴는 그대로, 오른쪽 내용만 교체 (SPA)
// 메뉴를 추가하려면 아래 ADMIN_MENU 에 한 줄 + router.js 의 /admin children 에 한 줄
// children 이 있으면 평소엔 접혀 있고, 그 메뉴 안에 있을 때만 아래에 소탭이 펼쳐짐 (아이템 관리 → 아이템 목록 · 캐릭터 아이템 관리 · 아이템 효과)
import { useRoute } from 'vue-router';

const route = useRoute();
const isOpen = (m) => !!m.children && route.path.startsWith(m.to);
const ADMIN_MENU = [
  {
    group: '회원',
    items: [
      { to: '/admin/applicants', label: '신청자 관리' },
      { to: '/admin/users', label: '회원 관리' },
    ],
  },
  {
    group: '콘텐츠',
    items: [
      { to: '/admin/contents', label: '페이지 관리' },
      { to: '/admin/menu', label: '메뉴 관리' },
    ],
  },
  {
    group: '캐릭터 · 아이템',
    items: [
      { to: '/admin/attributes', label: '캐릭터 항목 관리' },
      {
        to: '/admin/items', label: '아이템 관리',
        children: [
          { to: '/admin/items/list', label: '아이템 목록' },
          { to: '/admin/items/characters', label: '캐릭터 아이템 관리' },
          { to: '/admin/items/effects', label: '아이템 효과' },
        ],
      },
      { to: '/admin/shop', label: '상점 관리' },
    ],
  },
  {
    group: '사이트',
    items: [
      { to: '/admin/settings', label: '사이트 설정' },
      { to: '/admin/themes', label: '테마' },
    ],
  },
];
</script>

<template>
  <div class="admin-layout">
    <aside class="admin-side" aria-label="관리 메뉴">
      <h2 class="admin-side-title">관리</h2>
      <nav class="admin-nav">
        <div v-for="g in ADMIN_MENU" :key="g.group" class="admin-nav-group">
          <span class="admin-nav-label">{{ g.group }}</span>
          <template v-for="m in g.items" :key="m.to">
            <!-- 소탭이 있으면: 접혀 있다가, 위 항목을 누르면(→ 첫 소탭으로 이동) 그 아래 소탭이 펼쳐짐 -->
            <RouterLink :to="m.children?.[0].to ?? m.to" :class="{ 'has-sub': m.children, open: isOpen(m) }"
              :aria-expanded="m.children ? String(isOpen(m)) : undefined">{{ m.label }}</RouterLink>
            <div v-if="m.children && isOpen(m)" class="admin-nav-sub">
              <RouterLink v-for="c in m.children" :key="c.to" :to="c.to">{{ c.label }}</RouterLink>
            </div>
          </template>
        </div>
      </nav>
    </aside>
    <div class="admin-main">
      <RouterView />
    </div>
  </div>
</template>
