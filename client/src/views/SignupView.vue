<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { signup } from '../auth';

const router = useRouter();
const name = ref('');
const email = ref('');
const password = ref('');
const error = ref('');
const loading = ref(false);

async function submit() {
  error.value = '';
  loading.value = true;
  try {
    await signup(name.value, email.value, password.value);
    router.push('/');
  } catch (e) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <section class="card">
    <h1>회원가입</h1>
    <form class="form" @submit.prevent="submit">
      <label>이름 <input v-model="name" autocomplete="name" required maxlength="50" /></label>
      <label>이메일 <input v-model="email" type="email" autocomplete="email" required /></label>
      <label>비밀번호 (8자 이상) <input v-model="password" type="password" autocomplete="new-password" required minlength="8" /></label>
      <p v-if="error" class="error">{{ error }}</p>
      <button type="submit" :disabled="loading">{{ loading ? '가입 중…' : '가입하기' }}</button>
    </form>
  </section>
</template>
