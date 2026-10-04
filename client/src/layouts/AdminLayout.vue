<script setup>
// 관리 페이지 공통 틀: 관리 메뉴 + 아래에 각 관리 페이지(pages/admin/*)가 바뀌어 들어감
// router.js 에서 /admin 아래 자식 라우트로 등록 → 메뉴는 그대로, 내용만 교체
const ADMIN_MENU = [
  { to: '/admin/applicants', label: '신청자 관리' },
  { to: '/admin/users', label: '회원 관리' },
  { to: '/admin/contents', label: '페이지 관리' },
  { to: '/admin/attributes', label: '캐릭터 항목 관리' },
  { to: '/admin/items', label: '아이템 관리' },
  { to: '/admin/shop', label: '상점 관리' },
  { to: '/admin/settings', label: '사이트 설정' },
];
</script>

<template>
  <nav class="admin-nav">
    <RouterLink v-for="m in ADMIN_MENU" :key="m.to" :to="m.to">{{ m.label }}</RouterLink>
  </nav>
  <RouterView />
</template>
