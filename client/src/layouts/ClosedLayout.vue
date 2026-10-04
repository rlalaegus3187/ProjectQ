<script setup>
// 사이트 비공개 화면 (관리 → 사이트 설정 → 사이트 공개 꺼짐) — 관리자 말고는 어느 주소로 와도 이 화면만
//   문구는 관리자가 사이트 설정에서 정함 (마크다운). 관리자는 아래 '관리자 로그인'으로 들어옴
import { ref } from 'vue';
import { auth, login, logout } from '../auth';
import { site } from '../site';
import { MarkdownView } from '../markdown';

const showLogin = ref(false);
const username = ref('');
const password = ref('');
const error = ref('');
const busy = ref(false);

async function submit() {
  error.value = '';
  busy.value = true;
  try {
    await login(username.value, password.value);   // 관리자가 아니면 서버가 거부하고 안내 문구를 돌려줌
  } catch (e) {
    // 관리자가 아니면 서버가 비공개 문구를 돌려줌 → 문구는 이미 위에 있으니 짧게
    error.value = e.data?.siteClosed ? '지금은 관리자만 로그인할 수 있습니다.' : e.message;
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <main class="container gate closed-page">
    <header class="gate-head">
      <img v-if="site.favicon" :src="site.favicon" alt="" class="gate-icon" />
      <h1>{{ site.name }}</h1>
    </header>
    <section class="card closed-message">
      <MarkdownView :source="site.closedMessage || '홈페이지 비공개 상태입니다.'" />
    </section>

    <!-- 이미 로그인한 일반 회원 -->
    <p v-if="auth.user" class="muted closed-foot">
      {{ auth.user.username }}님으로 로그인되어 있습니다. <button type="button" class="link" @click="logout">로그아웃</button>
    </p>
    <template v-else>
      <p class="closed-foot"><button type="button" class="link small-link" @click="showLogin = !showLogin">관리자 로그인</button></p>
      <form v-if="showLogin" class="card form" @submit.prevent="submit">
        <label>아이디 <input v-model="username" autocomplete="username" required maxlength="20" autocapitalize="off" /></label>
        <label>비밀번호 <input v-model="password" type="password" autocomplete="current-password" required /></label>
        <p v-if="error" class="error">{{ error }}</p>
        <button type="submit" :disabled="busy">{{ busy ? '로그인 중…' : '로그인' }}</button>
      </form>
    </template>
  </main>
</template>
