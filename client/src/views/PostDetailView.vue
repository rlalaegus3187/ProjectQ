<script setup>
// 게시글 보기 (+ Q&A: 답변, 메인 글 지정)
import { ref, computed, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api } from '../api';
import { auth } from '../auth';
import { BOARDS, formatDate } from '../boards';
import MarkdownView from '../components/MarkdownView.vue';
import PostEditor from '../components/PostEditor.vue';

const route = useRoute();
const router = useRouter();
const boardKey = computed(() => route.params.board);
const board = computed(() => BOARDS[boardKey.value]);
const data = ref(null);
const error = ref('');
const reply = ref({ body: '' });
const editingReply = ref(null);   // { id, body }
const busy = ref(false);

async function load() {
  error.value = '';
  data.value = null;
  try {
    data.value = await api(`/boards/${boardKey.value}/posts/${route.params.id}`);
  } catch (e) {
    error.value = e.message;
  }
}

async function act(fn) {
  error.value = '';
  busy.value = true;
  try {
    await fn();
  } catch (e) {
    error.value = e.message;
  } finally {
    busy.value = false;
  }
}

const removePost = () => confirm('이 글을 삭제할까요?' + (boardKey.value === 'qna' ? '\n답변도 함께 삭제됩니다.' : '')) && act(async () => {
  await api(`/boards/${boardKey.value}/posts/${route.params.id}`, { method: 'DELETE' });
  router.push(`/${boardKey.value}`);
});

const togglePin = () => act(async () => {
  await api(`/boards/qna/posts/${route.params.id}/pin`, { method: 'PUT', body: { isPinned: !data.value.post.isPinned } });
  await load();
});

const addReply = () => act(async () => {
  await api(`/boards/qna/posts/${route.params.id}/replies`, { method: 'POST', body: { body: reply.value.body } });
  reply.value = { body: '' };
  await load();
});

const saveReply = () => act(async () => {
  await api(`/boards/qna/replies/${editingReply.value.id}`, { method: 'PUT', body: { body: editingReply.value.body } });
  editingReply.value = null;
  await load();
});

const removeReply = (r) => confirm('이 답변을 삭제할까요?') && act(async () => {
  await api(`/boards/qna/replies/${r.id}`, { method: 'DELETE' });
  await load();
});

watch(() => route.fullPath, load, { immediate: true });
</script>

<template>
  <section class="card">
    <RouterLink :to="`/${boardKey}`" class="muted">← {{ board.label }} 목록</RouterLink>

    <p v-if="error" class="error">{{ error }}</p>
    <p v-if="error && !auth.user && !data" class="muted"><RouterLink :to="{ path: '/login', query: { redirect: route.fullPath } }">로그인</RouterLink> 후 다시 확인해주세요.</p>

    <template v-if="data">
      <header class="post-head">
        <h1>
          <span v-if="data.post.isPinned" class="badge pin">메인</span>
          <span v-if="data.post.isHidden" class="badge lock">비밀</span>
          {{ data.post.title }}
        </h1>
        <p class="muted">
          {{ data.post.author }} · {{ new Date(data.post.createdAt).toLocaleString('ko-KR') }}
          <template v-if="data.post.updatedAt !== data.post.createdAt"> · 수정됨</template>
        </p>
        <div class="actions">
          <button v-if="data.canPin" type="button" class="secondary" :disabled="busy" @click="togglePin">
            {{ data.post.isPinned ? '메인 글 해제' : '메인 글로 올리기' }}
          </button>
          <RouterLink v-if="data.post.canEdit" :to="`/${boardKey}/${data.post.id}/edit`" class="button secondary">수정</RouterLink>
          <button v-if="data.post.canEdit" type="button" class="danger" :disabled="busy" @click="removePost">삭제</button>
        </div>
      </header>

      <MarkdownView :source="data.post.body" class="post-body" />
    </template>
  </section>

  <section v-if="data && boardKey === 'qna'" class="card">
    <h2>답변 {{ data.replies.length }}</h2>
    <p v-if="!data.replies.length" class="muted">아직 답변이 없습니다.</p>
    <article v-for="r in data.replies" :key="r.id" class="reply">
      <p class="muted"><span class="badge admin">관리자</span> {{ r.author }} · {{ new Date(r.createdAt).toLocaleString('ko-KR') }}</p>
      <form v-if="editingReply?.id === r.id" class="form" @submit.prevent="saveReply">
        <PostEditor v-model="editingReply" :with-title="false" :rows="6" />
        <div class="actions">
          <button type="submit" :disabled="busy">저장</button>
          <button type="button" class="secondary" @click="editingReply = null">취소</button>
        </div>
      </form>
      <template v-else>
        <MarkdownView :source="r.body" />
        <div v-if="data.canReply" class="actions small">
          <button type="button" class="secondary" @click="editingReply = { id: r.id, body: r.body }">수정</button>
          <button type="button" class="danger" :disabled="busy" @click="removeReply(r)">삭제</button>
        </div>
      </template>
    </article>

    <form v-if="data.canReply" class="form reply-form" @submit.prevent="addReply">
      <h3>답변 달기</h3>
      <PostEditor v-model="reply" :with-title="false" :rows="6" />
      <button type="submit" :disabled="busy">답변 등록</button>
    </form>
  </section>
</template>
