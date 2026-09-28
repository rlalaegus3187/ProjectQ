<script setup>
// 항목 값 표시 — 형식에 따라 이미지/링크/여러 줄 텍스트로 보여줌
defineProps({
  attr: { type: Object, required: true },
});

const isSafeLink = (url) => /^https?:\/\//i.test(url);
</script>

<template>
  <span v-if="attr.value === null || attr.value === ''" class="muted">-</span>
  <img v-else-if="attr.valueType === 'image'" :src="attr.value" :alt="attr.label" class="thumb" />
  <a v-else-if="attr.valueType === 'link' && isSafeLink(attr.value)" :href="attr.value" target="_blank" rel="noopener noreferrer">{{ attr.value }}</a>
  <span v-else-if="attr.valueType === 'long_text'" class="long-text">{{ attr.value }}</span>
  <span v-else>{{ attr.value }}</span>
</template>
