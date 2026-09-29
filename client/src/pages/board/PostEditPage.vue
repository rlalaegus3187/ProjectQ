<script setup>
// 글쓰기 / 수정 (공지·세계관·캐릭터 가이드는 관리자, Q&A 는 회원)
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api } from '../../api';
import { BOARDS } from '../../boards';
import PostEditor from '../../components/PostEditor.vue';

const route = useRoute();
const router = useRouter();
const boardKey = computed(() => route.params.board);
const board = computed(() => BOARDS[boardKey.value]);
const postId = computed(() => route.params.id);   // 없으면 새 글
const post = ref(postId.value ? null : { title: '', body: '', isHidden: false });
const error = ref('');
const saving = ref(false);

onMounted(async () => {
  if (!postId.value) return;
  try {
    const data = await api(`/boards/${boardKey.value}/posts/${postId.value}`);
    if (!data.post.canEdit) throw new Error('수정할 권한이 없습니다.');
    post.value = { title: data.post.title, body: data.post.body, isHidden: data.post.isHidden };
  } catch (e) {
    error.value = e.message;
  }
});

async function save() {
  error.value = '';
  saving.value = true;
  try {
    if (postId.value) {
      await api(`/boards/${boardKey.value}/posts/${postId.value}`, { method: 'PUT', body: post.value });
      router.push(`/${boardKey.value}/${postId.value}`);
    } else {
      const { id } = await api(`/boards/${boardKey.value}/posts`, { method: 'POST', body: post.value });
      router.push(`/${boardKey.value}/${id}`);
    }
  } catch (e) {
    error.value = e.message;
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <section class="card">
    <RouterLink :to="`/${boardKey}`" class="muted">← {{ board.label }} 목록</RouterLink>
    <h1>{{ board.label }} {{ postId ? '글 수정' : boardKey === 'qna' ? '질문하기' : '글쓰기' }}</h1>
    <form v-if="post" class="form" @submit.prevent="save">
      <PostEditor v-model="post" :allow-hidden="boardKey === 'qna'" />
      <p v-if="error" class="error">{{ error }}</p>
      <div class="actions">
        <button type="submit" :disabled="saving">{{ saving ? '저장 중…' : postId ? '수정 완료' : '등록' }}</button>
        <button type="button" class="secondary" @click="router.back()">취소</button>
      </div>
    </form>
    <p v-else-if="error" class="error">{{ error }}</p>
    <p v-else class="muted">불러오는 중…</p>
  </section>
</template>
