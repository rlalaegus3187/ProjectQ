<script setup>
// 글쓰기 / 수정 — Q&A 는 회원, 또는 (관리 → 사이트 설정에서 허용하면) 비회원
// 비회원 글 수정은 글 보기 화면에서 비밀번호를 확인한 뒤 들어옴 (권한은 서버가 판단)
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api } from '../../api';
import { auth } from '../../auth';
import { BOARDS } from '../../boards';
import PostEditor from '../../components/PostEditor.vue';

const route = useRoute();
const router = useRouter();
const boardKey = computed(() => route.params.board);
const board = computed(() => BOARDS[boardKey.value]);
const postId = computed(() => route.params.id);   // 없으면 새 글
const post = ref(null);
const isGuestPost = ref(false);   // 비회원 글 (새 글: 비회원으로 쓰는 중 / 수정: 비회원이 쓴 글)
const hasPassword = ref(false);
const error = ref('');
const needLogin = ref(false);
const saving = ref(false);

const passwordMode = computed(() => {
  if (boardKey.value !== 'qna') return 'none';
  return isGuestPost.value ? 'guest' : 'member';
});

onMounted(async () => {
  try {
    if (postId.value) {
      const data = await api(`/boards/${boardKey.value}/posts/${postId.value}`);
      if (!data.post.canEdit) throw new Error('수정할 권한이 없습니다. 비회원 글은 글 화면에서 비밀번호를 먼저 확인해주세요.');
      isGuestPost.value = data.post.isGuest;
      hasPassword.value = data.post.hasPassword;
      post.value = { title: data.post.title, body: data.post.body, isHidden: data.post.isHidden, password: '', removePassword: false };
    } else {
      const access = await api(`/boards/${boardKey.value}/write-access`);
      if (!access.canWrite) {
        needLogin.value = !auth.user;
        throw new Error(auth.user ? '글을 쓸 권한이 없습니다.' : '로그인한 회원만 글을 쓸 수 있습니다.');
      }
      isGuestPost.value = access.guestWrite;
      post.value = { title: '', body: '', isHidden: false, guestName: '', password: '' };
    }
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
    <p v-if="!postId && isGuestPost" class="muted">
      비회원으로 작성합니다. 비밀번호는 글을 수정·삭제하거나 비밀글을 볼 때 필요하니 꼭 기억해주세요.
      <RouterLink :to="{ path: '/login', query: { redirect: route.fullPath } }">로그인</RouterLink>하면 답변 알림을 받을 수 있습니다.
    </p>
    <form v-if="post" class="form" @submit.prevent="save">
      <PostEditor v-model="post" :allow-hidden="boardKey === 'qna'" :password-mode="passwordMode"
        :editing="!!postId" :has-password="hasPassword" />
      <p v-if="error" class="error">{{ error }}</p>
      <div class="actions">
        <button type="submit" :disabled="saving">{{ saving ? '저장 중…' : postId ? '수정 완료' : '등록' }}</button>
        <button type="button" class="secondary" @click="router.back()">취소</button>
      </div>
    </form>
    <template v-else-if="error">
      <p class="error">{{ error }}</p>
      <p v-if="needLogin"><RouterLink :to="{ path: '/login', query: { redirect: route.fullPath } }" class="button">로그인</RouterLink></p>
    </template>
    <p v-else class="muted">불러오는 중…</p>
  </section>
</template>
