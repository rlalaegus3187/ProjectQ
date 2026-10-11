<script setup>
// 환영 문구 — 사이트 이름 + 로그인/회원가입 안내
import { auth } from '../auth';
import { site } from '../site';

defineProps({ data: { type: Object, default: null } });   // 이 모듈은 데이터 없음
</script>

<template>
  <section class="card">
    <h1>{{ site.name }}</h1>
    <p v-if="auth.user">{{ auth.user.username }}님, 환영합니다. <RouterLink to="/mypage">내 캐릭터 보기</RouterLink></p>
    <p v-else-if="site.signupOpen"><RouterLink to="/signup">회원가입</RouterLink>하고 캐릭터를 만들어보세요.</p>
    <p v-else class="muted">지금은 회원가입을 받지 않습니다. <RouterLink to="/login">로그인</RouterLink></p>
  </section>
</template>
