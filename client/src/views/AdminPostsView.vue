<script setup>
// 관리자: 공지 / 세계관 / 캐릭터 가이드 게시글 관리 (등록·수정·삭제)
import { ref, computed, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api } from '../api';
import { ADMIN_BOARD_KEYS, BOARDS, formatDate } from '../boards';
import AdminNav from '../components/AdminNav.vue';

const route = useRoute();
const router = useRouter();
const boardKey = computed(() => (ADMIN_BOARD_KEYS.includes(route.query.board) ? route.query.board : ADMIN_BOARD_KEYS[0]));
const data = ref(null);
const error = ref('');

async function load() {
  error.value = '';
  try {
    data.value = await api(`/boards/${boardKey.value}/posts?page=${Number(route.query.page) || 1}`);
  } catch (e) {
    error.value = e.message;
  }
}

async function remove(post) {
  if (!confirm(`'${post.title}' 글을 삭제할까요?`)) return;
  try {
    await api(`/boards/${boardKey.value}/posts/${post.id}`, { method: 'DELETE' });
    await load();
  } catch (e) {
    error.value = e.message;
  }
}

const totalPages = computed(() => (data.value ? Math.max(1, Math.ceil(data.value.total / data.value.pageSize)) : 1));

watch(() => route.fullPath, load, { immediate: true });
</script>

<template>
  <AdminNav />
  <section class="card">
    <h1>게시글 관리</h1>
    <div class="tabs">
      <RouterLink v-for="key in ADMIN_BOARD_KEYS" :key="key" :to="{ query: { board: key } }" :class="{ active: key === boardKey }">
        {{ BOARDS[key].label }}
      </RouterLink>
    </div>

    <div class="card-head">
      <p class="muted">
        <RouterLink :to="`/${boardKey}`">{{ BOARDS[boardKey].label }} 페이지</RouterLink>에 게시됩니다.
      </p>
      <RouterLink :to="`/${boardKey}/write`" class="button">새 글 쓰기</RouterLink>
    </div>
    <p v-if="error" class="error">{{ error }}</p>

    <template v-if="data">
      <p v-if="!data.posts.length" class="muted">아직 글이 없습니다.</p>
      <div v-else class="table-wrap">
        <table class="table">
          <thead><tr><th>제목</th><th>작성자</th><th>작성일</th><th></th></tr></thead>
          <tbody>
            <tr v-for="post in data.posts" :key="post.id">
              <td class="title-cell"><RouterLink :to="`/${boardKey}/${post.id}`">{{ post.title }}</RouterLink></td>
              <td>{{ post.author }}</td>
              <td>{{ formatDate(post.createdAt) }}</td>
              <td class="row-actions">
                <RouterLink :to="`/${boardKey}/${post.id}/edit`" class="button secondary small">수정</RouterLink>
                <button type="button" class="danger" @click="remove(post)">삭제</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <nav v-if="totalPages > 1" class="pager">
        <button type="button" class="secondary" :disabled="data.page <= 1" @click="router.push({ query: { board: boardKey, page: data.page - 1 } })">이전</button>
        <span>{{ data.page }} / {{ totalPages }}</span>
        <button type="button" class="secondary" :disabled="data.page >= totalPages" @click="router.push({ query: { board: boardKey, page: data.page + 1 } })">다음</button>
      </nav>
    </template>
  </section>
</template>
