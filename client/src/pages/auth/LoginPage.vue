<script setup>
// 로그인 — 회원 전용 모드(관리 → 사이트 설정)면 상단 메뉴 없이 이 화면만 보이는 입장 화면
import { ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { login } from '../../auth';
import { site } from '../../site';

const route = useRoute();
const router = useRouter();
const username = ref('');
const password = ref('');
const error = ref('');
const loading = ref(false);

async function submit() {
  error.value = '';
  loading.value = true;
  try {
    await login(username.value, password.value);
    // 로그인 전에 가려던 페이지로, 없으면 회원 전용 모드는 메인, 아니면 내 캐릭터(마이페이지)로 (내부 경로만 허용)
    const fallback = site.private ? '/' : '/mypage';
    const redirect = String(route.query.redirect || fallback);
    router.push(redirect.startsWith('/') && !redirect.startsWith('//') ? redirect : fallback);
  } catch (e) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <!-- 회원 전용 모드: 사이트 이름을 크게 보여주는 입장 화면 -->
  <header v-if="site.private" class="gate-head">
    <img v-if="site.favicon" :src="site.favicon" alt="" class="gate-icon" />
    <h1>{{ site.name }}</h1>
    <p class="muted">회원 전용 사이트입니다. 로그인해주세요.</p>
  </header>
  <section class="card" :class="{ 'gate-card': site.private }">
    <h1 v-if="!site.private">로그인</h1>
    <form class="form" @submit.prevent="submit">
      <label>아이디 <input v-model="username" autocomplete="username" required maxlength="20" autocapitalize="off" spellcheck="false" /></label>
      <label>비밀번호 <input v-model="password" type="password" autocomplete="current-password" required /></label>
      <p v-if="error" class="error">{{ error }}</p>
      <button type="submit" :disabled="loading">{{ loading ? '로그인 중…' : '로그인' }}</button>
    </form>
    <p class="muted">계정이 없나요? <RouterLink to="/signup">회원가입</RouterLink></p>
  </section>
</template>
