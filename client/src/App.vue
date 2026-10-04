<script setup>
import { useRouter } from 'vue-router';
import { auth, isAdmin, logout } from './auth';
import { SITE_MENU, menuLabel } from './menu';
import { loadContentTitles } from './contents';
import { site, loadSite } from './site';
import { notifications, refreshUnread } from './notifications';
import { computed, onMounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import { MusicPlayer, setSiteMusic, usePageMusic } from './music';

const router = useRouter();
const route = useRoute();

// 라우트별 음악: router.js 에서 { path, component, meta: { music: '영상ID' } } 로 지정 가능
usePageMusic(() => route.meta.music);

// 사이트 이름·파비콘·회원 전용 여부, 사이트 전체 음악 (관리 → 사이트 설정)
onMounted(async () => {
  await loadSite();
  setSiteMusic(site.music);
});

// 회원 전용 모드에서 로그인 전: 상단 메뉴 없이 로그인/회원가입 화면만 (layouts 대신 App 에서 처리)
const gate = computed(() => site.private && !auth.user);

// 콘텐츠 페이지 제목 (메뉴 이름) — 회원 전용이면 로그인한 뒤에 불러와짐
watch(() => auth.user?.id, () => loadContentTitles().catch(() => { /* 실패하면 기본 이름 */ }), { immediate: true });

async function onLogout() {
  await logout();
  await refreshUnread({ force: true });
  router.push('/');
}
</script>

<template>
  <header v-if="!gate" class="nav">
    <div class="nav-left">
      <RouterLink to="/" class="brand">{{ site.name }}</RouterLink>
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
        <RouterLink to="/mypage">{{ auth.user.username }}님</RouterLink>
        <button class="link" @click="onLogout">로그아웃</button>
      </template>
      <template v-else>
        <RouterLink to="/login">로그인</RouterLink>
        <RouterLink v-if="site.signupOpen" to="/signup">회원가입</RouterLink>
      </template>
    </nav>
  </header>
  <!-- 관리 페이지는 왼쪽 메뉴가 있어서 넓게 -->
  <main class="container" :class="{ gate, wide: route.path.startsWith('/admin') }">
    <RouterView />
  </main>
  <MusicPlayer />
</template>
