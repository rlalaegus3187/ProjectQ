<script setup>
import { auth } from '../../auth';
import { visibleMenu, menuLabel } from '../../menu';
import { site } from '../../site';
</script>

<template>
  <section class="card">
    <h1>{{ site.name }}</h1>
    <p v-if="auth.user">{{ auth.user.username }}님, 환영합니다. <RouterLink to="/mypage">내 캐릭터 보기</RouterLink></p>
    <p v-else-if="site.signupOpen"><RouterLink to="/signup">회원가입</RouterLink>하고 캐릭터를 만들어보세요.</p>
    <p v-else class="muted">지금은 회원가입을 받지 않습니다. <RouterLink to="/login">로그인</RouterLink></p>
  </section>

  <section class="board-cards">
    <RouterLink v-for="m in visibleMenu()" :key="m.to" :to="m.to" class="card board-card">
      <strong>{{ menuLabel(m) }}</strong>
    </RouterLink>
  </section>
</template>
