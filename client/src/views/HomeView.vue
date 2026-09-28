<script setup>
import { ref, onMounted } from 'vue';
import { api } from '../api';
import { auth } from '../auth';

const posts = ref([]);
const title = ref('');
const body = ref('');
const error = ref('');

async function loadPosts() {
  posts.value = (await api('/posts')).posts;
}

async function submit() {
  error.value = '';
  try {
    await api('/posts', { method: 'POST', body: { title: title.value, body: body.value } });
    title.value = '';
    body.value = '';
    await loadPosts();
  } catch (e) {
    error.value = e.message;
  }
}

onMounted(loadPosts);
</script>

<template>
  <section class="card">
    <h1>ProjectQ 샘플</h1>
    <p v-if="auth.user">{{ auth.user.name }}님, 환영합니다. 아래에서 글을 남겨보세요.</p>
    <p v-else>글 목록은 누구나 볼 수 있고, 글쓰기는 <RouterLink to="/login">로그인</RouterLink> 후 가능합니다.</p>
  </section>

  <section v-if="auth.user" class="card">
    <form class="form" @submit.prevent="submit">
      <input v-model="title" placeholder="제목" required maxlength="200" />
      <textarea v-model="body" placeholder="내용" rows="3" />
      <p v-if="error" class="error">{{ error }}</p>
      <button type="submit">등록</button>
    </form>
  </section>

  <section class="card">
    <h2>게시글</h2>
    <p v-if="!posts.length" class="muted">아직 글이 없습니다.</p>
    <article v-for="post in posts" :key="post.id" class="post">
      <h3>{{ post.title }}</h3>
      <p>{{ post.body }}</p>
      <span class="muted">{{ post.author }} · {{ new Date(post.createdAt).toLocaleString() }}</span>
    </article>
  </section>
</template>
