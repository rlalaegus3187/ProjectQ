<script setup>
// 마크다운 편집기: 공통 툴바(MarkdownToolbar — 채팅 입력칸과 같은 버튼) + 입력칸
//   <MarkdownEditor v-model="text" :rows="10" :maxlength="10000" id="bio" />
import { ref } from 'vue';
import MarkdownToolbar from './MarkdownToolbar.vue';

const props = defineProps({
  id: { type: String, default: undefined },            // <label for> 연결용
  rows: { type: Number, default: 10 },
  maxlength: { type: Number, default: 50000 },
  placeholder: { type: String, default: '내용을 입력하세요. (마크다운: ## 제목, **굵게**, - 목록)' },
});
const text = defineModel({ type: String, default: '' });
const textarea = ref(null);
</script>

<template>
  <div class="markdown-editor">
    <MarkdownToolbar v-model="text" :target="textarea" />
    <textarea :id="props.id" ref="textarea" v-model="text" :rows="props.rows"
      :maxlength="props.maxlength" :placeholder="props.placeholder" />
  </div>
</template>
