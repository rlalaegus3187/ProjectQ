<script setup>
// 게시판 목록 (공지 / 세계관 / 캐릭터 가이드 / Q&A)
import { ref, computed, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api } from '../../api';
import { BOARDS, formatDate } from '../../boards';

const route = useRoute();
const router = useRouter();
const boardKey = computed(() => route.params.board);
const board = computed(() => BOARDS[boardKey.value]);
const data = ref(null);
const error = ref('');

const page = computed(() => Math.max(1, Number(route.query.page) || 1));
const totalPages = computed(() => (data.value ? Math.max(1, Math.ceil(data.value.total / data.value.pageSize)) : 1));

async function load() {
  error.value = '';
  try {
    data.value = await api(`/boards/${boardKey.value}/posts?page=${page.value}`);
  } catch (e) {
    error.value = e.message;
  }
}

function goPage(n) {
  router.push({ query: n > 1 ? { page: n } : {} });
}

watch([boardKey, page], load, { immediate: true });
</script>

<template>
  <section class="card">
    <div class="card-head">
      <h1>{{ board.label }}</h1>
      <RouterLink v-if="data?.canWrite" :to="`/${boardKey}/write`" class="button">
        {{ boardKey === 'qna' ? '질문하기' : '글쓰기' }}
      </RouterLink>
    </div>
    <p v-if="boardKey === 'qna'" class="muted">
      궁금한 점을 남겨주세요. 관리자가 답변하면 알림으로 알려드립니다. 비밀글은 작성자와 관리자만 볼 수 있습니다.
    </p>
    <p v-if="error" class="error">{{ error }}</p>

    <template v-if="data">
      <div v-if="data.pinned.length" class="pinned">
        <h2 class="pinned-title">메인 글</h2>
        <ul class="post-list">
          <li v-for="post in data.pinned" :key="post.id">
            <component :is="post.locked ? 'div' : 'RouterLink'" :to="post.locked ? undefined : `/${boardKey}/${post.id}`"
              class="post-link" :class="{ locked: post.locked }">
              <span class="post-title">
                <span class="badge pin">메인</span><span v-if="post.isHidden" class="badge lock">비밀</span>{{ post.title }}
              </span>
              <span class="post-meta">
                <span class="badge" :class="post.replyCount ? 'answered' : 'waiting'">{{ post.replyCount ? '답변완료' : '답변대기' }}</span>
                {{ post.author }} · {{ formatDate(post.createdAt) }}
              </span>
            </component>
          </li>
        </ul>
      </div>

      <p v-if="!data.posts.length" class="muted">아직 글이 없습니다.</p>
      <ul v-else class="post-list">
        <li v-for="post in data.posts" :key="post.id">
          <RouterLink v-if="!post.locked" :to="`/${boardKey}/${post.id}`" class="post-link">
            <span class="post-title"><span v-if="post.isHidden" class="badge lock">비밀</span>{{ post.title }}</span>
            <span class="post-meta">
              <span v-if="boardKey === 'qna'" class="badge" :class="post.replyCount ? 'answered' : 'waiting'">{{ post.replyCount ? '답변완료' : '답변대기' }}</span>
              {{ post.author }} · {{ formatDate(post.createdAt) }}
            </span>
          </RouterLink>
          <div v-else class="post-link locked">
            <span class="post-title"><span class="badge lock">비밀</span>{{ post.title }}</span>
            <span class="post-meta">
              <span class="badge" :class="post.replyCount ? 'answered' : 'waiting'">{{ post.replyCount ? '답변완료' : '답변대기' }}</span>
              {{ post.author }} · {{ formatDate(post.createdAt) }}
            </span>
          </div>
        </li>
      </ul>

      <nav v-if="totalPages > 1" class="pager">
        <button type="button" class="secondary" :disabled="page <= 1" @click="goPage(page - 1)">이전</button>
        <span>{{ page }} / {{ totalPages }}</span>
        <button type="button" class="secondary" :disabled="page >= totalPages" @click="goPage(page + 1)">다음</button>
      </nav>
    </template>
  </section>
</template>
