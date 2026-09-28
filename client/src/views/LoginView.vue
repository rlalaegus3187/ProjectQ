<script setup>
import { ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { login } from '../auth';

const route = useRoute();
const router = useRouter();
const email = ref('');
const password = ref('');
const error = ref('');
const loading = ref(false);

async function submit() {
  error.value = '';
  loading.value = true;
  try {
    await login(email.value, password.value);
    // 로그인 전에 가려던 페이지로 이동 (내부 경로만 허용)
    const redirect = String(route.query.redirect || '/');
    router.push(redirect.startsWith('/') && !redirect.startsWith('//') ? redirect : '/');
  } catch (e) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <section class="card">
    <h1>로그인</h1>
    <form class="form" @submit.prevent="submit">
      <label>이메일 <input v-model="email" type="email" autocomplete="email" required /></label>
      <label>비밀번호 <input v-model="password" type="password" autocomplete="current-password" required /></label>
      <p v-if="error" class="error">{{ error }}</p>
      <button type="submit" :disabled="loading">{{ loading ? '로그인 중…' : '로그인' }}</button>
    </form>
    <p class="muted">계정이 없나요? <RouterLink to="/signup">회원가입</RouterLink></p>
  </section>
</template>
