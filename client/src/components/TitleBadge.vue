<script setup>
// 칭호 배지 — <TitleBadge :title="{ name, color }" />  (color 가 없으면 사이트 강조색)
// 마우스를 올리면 설명(description)이 보임
defineProps({
  title: { type: Object, required: true },
});
</script>

<template>
  <span class="title-badge" :style="title.color ? { '--title-color': title.color } : null" :title="title.description || null">{{ title.name }}</span>
</template>
