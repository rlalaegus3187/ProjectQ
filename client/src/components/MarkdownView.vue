<script setup>
// 게시글 본문(마크다운) 표시 — XSS 방지를 위해 DOMPurify 로 정리한 HTML 만 렌더링
import { computed } from 'vue';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

const props = defineProps({
  source: { type: String, default: '' },
});

// 외부 링크는 새 탭으로
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A' && /^https?:\/\//i.test(node.getAttribute('href') || '')) {
    node.setAttribute('target', '_blank');
    node.setAttribute('rel', 'noopener noreferrer');
  }
});

const html = computed(() => DOMPurify.sanitize(marked.parse(props.source || '', { breaks: true, gfm: true })));
</script>

<template>
  <!-- eslint-disable-next-line vue/no-v-html -- DOMPurify 로 정리된 HTML -->
  <div class="markdown" v-html="html" />
</template>
