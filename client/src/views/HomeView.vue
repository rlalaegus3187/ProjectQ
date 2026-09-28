<script setup>
import { ref, onMounted } from 'vue';
import { api } from '../api';
import { auth } from '../auth';
import { BOARDS, formatDate } from '../boards';

const notices = ref([]);

onMounted(async () => {
  try {
    notices.value = (await api('/boards/notice/posts')).posts.slice(0, 5);
  } catch {
    notices.value = [];
  }
});
</script>

<template>
  <section class="card">
    <h1>ProjectQ</h1>
    <p v-if="auth.user">{{ auth.user.name }}님, 환영합니다. <RouterLink to="/mypage">내 캐릭터 보기</RouterLink></p>
    <p v-else><RouterLink to="/signup">회원가입</RouterLink>하고 캐릭터를 만들어보세요.</p>
  </section>

  <section class="card">
    <div class="card-head">
      <h2>공지</h2>
      <RouterLink to="/notice" class="muted">더보기 →</RouterLink>
    </div>
    <p v-if="!notices.length" class="muted">공지가 없습니다.</p>
    <ul v-else class="post-list">
      <li v-for="post in notices" :key="post.id">
        <RouterLink :to="`/notice/${post.id}`" class="post-link">
          <span class="post-title">{{ post.title }}</span>
          <span class="post-meta">{{ formatDate(post.createdAt) }}</span>
        </RouterLink>
      </li>
    </ul>
  </section>

  <section class="board-cards">
    <RouterLink v-for="(b, key) in BOARDS" :key="key" :to="`/${key}`" class="card board-card">
      <strong>{{ b.label }}</strong>
      <span class="muted">{{ key === 'qna' ? '질문하고 답변 받기' : '읽어보기' }}</span>
    </RouterLink>
  </section>
</template>
