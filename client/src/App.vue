<script setup>
import { useRouter } from 'vue-router';
import { auth, isAdmin, logout } from './auth';
import { SITE_MENU } from './menu';
import { notifications, refreshUnread } from './notifications';

const router = useRouter();

async function onLogout() {
  await logout();
  await refreshUnread({ force: true });
  router.push('/');
}
</script>

<template>
  <header class="nav">
    <div class="nav-left">
      <RouterLink to="/" class="brand">ProjectQ</RouterLink>
      <nav class="board-links">
        <RouterLink v-for="m in SITE_MENU" :key="m.to" :to="m.to">{{ m.label }}</RouterLink>
      </nav>
    </div>
    <nav>
      <template v-if="auth.user">
        <RouterLink to="/notifications" class="bell">
          알림<span v-if="notifications.unread" class="count">{{ notifications.unread > 99 ? '99+' : notifications.unread }}</span>
        </RouterLink>
        <RouterLink v-if="isAdmin()" to="/admin">관리</RouterLink>
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
