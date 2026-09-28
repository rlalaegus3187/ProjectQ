<script setup>
import { useRouter } from 'vue-router';
import { auth, isAdmin, logout } from './auth';

const router = useRouter();

async function onLogout() {
  await logout();
  router.push('/');
}
</script>

<template>
  <header class="nav">
    <RouterLink to="/" class="brand">ProjectQ</RouterLink>
    <nav>
      <template v-if="auth.user">
        <RouterLink v-if="isAdmin()" to="/admin">항목 관리</RouterLink>
        <RouterLink to="/mypage">{{ auth.user.name }}님</RouterLink>
        <button class="link" @click="onLogout">로그아웃</button>
      </template>
      <template v-else>
        <RouterLink to="/login">로그인</RouterLink>
        <RouterLink to="/signup">회원가입</RouterLink>
      </template>
    </nav>
  </header>
  <main class="container">
    <RouterView />
  </main>
</template>
