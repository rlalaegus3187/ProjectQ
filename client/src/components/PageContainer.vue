<script setup>
// 콘텐츠 페이지 공통 컨테이너 (제목 + 설명 + 내용 영역)
// 사용: <PageContainer title="세계관" description="..."> 내용 </PageContainer>
//       제목 오른쪽 버튼: <template #actions> ... </template>
defineProps({
  title: { type: String, required: true },
  description: { type: String, default: '' },
});
</script>

<template>
  <section class="card page-container">
    <header class="page-header">
      <div class="card-head">
        <h1>{{ title }}</h1>
        <slot name="actions" />
      </div>
      <p v-if="description" class="muted">{{ description }}</p>
    </header>
    <div class="page-body">
      <slot>
        <p class="muted">준비 중입니다.</p>
      </slot>
    </div>
  </section>
</template>
