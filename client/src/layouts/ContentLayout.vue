<script setup>
// 콘텐츠 페이지 공통 틀 (메뉴의 페이지들: 공지·세계관 ... + 관리자가 추가한 페이지)
//   위: 제목 · 제목 오른쪽 버튼 · 알림 / 아래: 본문
//
//   <ContentLayout :title="...">
//     <template #actions> 제목 오른쪽 버튼 </template>
//     <template #notice> 제목 아래 안내 </template>
//     본문
//   </ContentLayout>
//
// 내용(데이터)은 쓰는 쪽(pages/content/ContentPage.vue)이 채우고, 이 파일은 모양만 담당
defineProps({
  title: { type: String, required: true },
});
</script>

<template>
  <section class="card content-page">
    <header class="page-header">
      <div class="card-head">
        <h1>{{ title }}</h1>
        <slot name="actions" />
      </div>
      <slot name="notice" />
    </header>
    <div class="content-body">
      <slot />
    </div>
  </section>
</template>
