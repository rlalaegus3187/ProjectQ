<script setup>
// 메뉴 바로가기 — 상단 메뉴 항목을 카드로
import { siteMenu, menuLabel } from '../menu';

defineProps({ data: { type: Object, default: null } });   // 이 모듈은 데이터 없음
</script>

<template>
  <section class="board-cards">
    <RouterLink v-for="m in siteMenu.items" :key="m.key" :to="m.to" class="card board-card">
      <strong>{{ menuLabel(m) }}</strong>
    </RouterLink>
  </section>
</template>
