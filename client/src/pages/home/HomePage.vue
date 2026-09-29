<script setup>
import { auth } from '../../auth';
import { SITE_MENU, menuLabel } from '../../menu';
</script>

<template>
  <section class="card">
    <h1>ProjectQ</h1>
    <p v-if="auth.user">{{ auth.user.name }}님, 환영합니다. <RouterLink to="/mypage">내 캐릭터 보기</RouterLink></p>
    <p v-else><RouterLink to="/signup">회원가입</RouterLink>하고 캐릭터를 만들어보세요.</p>
  </section>

  <section class="board-cards">
    <RouterLink v-for="m in SITE_MENU" :key="m.to" :to="m.to" class="card board-card">
      <strong>{{ menuLabel(m) }}</strong>
    </RouterLink>
  </section>
</template>
