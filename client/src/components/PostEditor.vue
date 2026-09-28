<script setup>
// 게시글 등록툴: 제목 + 본문(마크다운 모듈) (+ Q&A 비밀글)
import { MarkdownEditor } from '../markdown';

defineProps({
  allowHidden: { type: Boolean, default: false },
  titleLabel: { type: String, default: '제목' },
  withTitle: { type: Boolean, default: true },
  rows: { type: Number, default: 14 },
});
const post = defineModel({ type: Object, required: true });   // { title, body, isHidden }
</script>

<template>
  <div class="post-editor">
    <label v-if="withTitle" class="field">
      {{ titleLabel }}
      <input v-model="post.title" required maxlength="200" />
    </label>

    <MarkdownEditor v-model="post.body" :rows="rows" :maxlength="50000" />

    <label v-if="allowHidden" class="inline">
      <input v-model="post.isHidden" type="checkbox" /> 비밀글 (작성자와 관리자만 볼 수 있음)
    </label>
  </div>
</template>
