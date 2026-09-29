<script setup>
import { useRouter } from 'vue-router';
import { auth, isAdmin, logout } from './auth';
import { SITE_MENU, menuLabel } from './menu';
import { loadContentTitles } from './contents';
import { notifications, refreshUnread } from './notifications';
import { onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { api } from './api';
import { MusicPlayer, setSiteMusic, usePageMusic } from './music';

const router = useRouter();
const route = useRoute();

// 라우트별 음악: router.js 에서 { path, component, meta: { music: '영상ID' } } 로 지정 가능
usePageMusic(() => route.meta.music);

// 사이트 전체 음악 (관리자 설정)
onMounted(async () => {
  try {
    setSiteMusic((await api('/settings')).siteMusic);
  } catch { /* 음악 설정을 못 불러와도 사이트는 동작 */ }
});
// 콘텐츠 페이지 제목 (메뉴 이름)
onMounted(() => loadContentTitles().catch(() => { /* 실패하면 기본 이름 */ }));

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
        <RouterLink v-for="m in SITE_MENU" :key="m.to" :to="m.to">{{ menuLabel(m) }}</RouterLink>
      </nav>
    </div>
    <nav>
      <template v-if="auth.user">
        <RouterLink to="/inventory">인벤토리</RouterLink>
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
  <MusicPlayer />
</template>
