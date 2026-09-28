<script setup>
// 마크다운 표시 — renderMarkdown 으로 정리(XSS 제거)한 HTML 만 렌더링
import { computed } from 'vue';
import { renderMarkdown } from './render';

const props = defineProps({
  source: { type: String, default: '' },
});

const html = computed(() => renderMarkdown(props.source));
</script>

<template>
  <!-- eslint-disable-next-line vue/no-v-html -- renderMarkdown(DOMPurify) 로 정리된 HTML -->
  <div class="markdown" v-html="html" />
</template>
