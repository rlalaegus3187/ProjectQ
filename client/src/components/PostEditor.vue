<script setup>
// 게시글 등록툴: 제목 + 본문(마크다운 모듈) (+ Q&A 비밀글 · 글 비밀번호 · 비회원 이름)
//   passwordMode: 'none' | 'guest'(비회원: 이름 + 비밀번호) | 'member'(회원 비밀글이면 비밀번호 선택)
//   editing: 수정 화면 (비밀번호를 비우면 그대로), hasPassword: 이미 비밀번호가 걸려 있는지
import { MarkdownEditor } from '../markdown';

defineProps({
  allowHidden: { type: Boolean, default: false },
  titleLabel: { type: String, default: '제목' },
  withTitle: { type: Boolean, default: true },
  rows: { type: Number, default: 14 },
  passwordMode: { type: String, default: 'none' },
  editing: { type: Boolean, default: false },
  hasPassword: { type: Boolean, default: false },
});
// { title, body, isHidden, guestName?, password?, removePassword? }
const post = defineModel({ type: Object, required: true });
</script>

<template>
  <div class="post-editor">
    <div v-if="passwordMode === 'guest'" class="two-col">
      <label v-if="!editing" class="field">
        이름 <span class="muted">(비회원)</span>
        <input v-model="post.guestName" required maxlength="20" autocomplete="nickname" />
      </label>
      <label class="field">
        비밀번호 <span class="muted">{{ editing ? '(바꿀 때만 입력)' : '(수정·삭제할 때 필요, 4자 이상)' }}</span>
        <input v-model="post.password" type="password" :required="!editing" minlength="4" maxlength="50" autocomplete="new-password" />
      </label>
    </div>

    <label v-if="withTitle" class="field">
      {{ titleLabel }}
      <input v-model="post.title" required maxlength="200" />
    </label>

    <MarkdownEditor v-model="post.body" :rows="rows" :maxlength="50000" />

    <label v-if="allowHidden" class="inline">
      <input v-model="post.isHidden" type="checkbox" />
      비밀글 ({{ passwordMode === 'guest' ? '비밀번호를 아는 사람과 관리자만' : '작성자와 관리자만' }} 볼 수 있음)
    </label>

    <!-- 회원 비밀글: 비밀번호를 걸면 로그인하지 않아도 비밀번호로 볼 수 있음 (선택) -->
    <div v-if="passwordMode === 'member' && post.isHidden" class="field">
      <span>
        비밀글 비밀번호 <span class="muted">(선택 — 걸면 비밀번호를 아는 사람도 볼 수 있음)</span>
      </span>
      <input v-model="post.password" type="password" minlength="4" maxlength="50" autocomplete="new-password"
        :disabled="post.removePassword" :placeholder="hasPassword ? '비밀번호가 걸려 있음 — 바꿀 때만 입력' : '비우면 비밀번호 없음'" />
      <label v-if="hasPassword" class="inline">
        <input v-model="post.removePassword" type="checkbox" /> 비밀번호 없애기
      </label>
    </div>
  </div>
</template>
