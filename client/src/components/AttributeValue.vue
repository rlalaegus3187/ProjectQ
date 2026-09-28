<script setup>
// 항목 값 표시 — 형식에 따라 이미지/링크/마크다운으로 보여줌
import { MarkdownView } from '../markdown';
defineProps({
  attr: { type: Object, required: true },
});

const isSafeLink = (url) => /^https?:\/\//i.test(url);
</script>

<template>
  <span v-if="attr.value === null || attr.value === ''" class="muted">-</span>
  <img v-else-if="attr.valueType === 'image'" :src="attr.value" :alt="attr.label" class="thumb" />
  <a v-else-if="attr.valueType === 'link' && isSafeLink(attr.value)" :href="attr.value" target="_blank" rel="noopener noreferrer">{{ attr.value }}</a>
  <MarkdownView v-else-if="attr.valueType === 'long_text'" :source="attr.value" />
  <span v-else>{{ attr.value }}</span>
</template>
