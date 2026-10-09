<script setup>
// 콘텐츠 페이지 (/notice, /world ... + 관리자가 추가한 페이지) — 이 파일 하나가 주소의 slug 로 DB 내용을 불러옴
// 모양은 layouts/ContentLayout.vue, 여기는 데이터와 본문(마크다운)만
// 내용은 관리 → 페이지 관리에서 작성
import { ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { api } from '../../api';
import { isAdmin } from '../../auth';
import { MarkdownView } from '../../markdown';
import { usePageMusic } from '../../music';
import ContentLayout from '../../layouts/ContentLayout.vue';

const route = useRoute();
const page = ref(null);
const error = ref('');

// 페이지 음악이 있으면 이 페이지에 있는 동안만 재생
usePageMusic(() => page.value?.musicVideoId);

async function load(slug) {
  error.value = '';
  page.value = null;
  try {
    page.value = (await api(`/contents/${slug}`)).page;
  } catch (e) {
    error.value = e.message;
  }
}

watch(() => route.params.slug, (slug) => { if (slug) load(slug); }, { immediate: true });
</script>

<template>
  <p v-if="error" class="card error">{{ error }}</p>
  <p v-else-if="!page" class="muted">불러오는 중…</p>
  <ContentLayout v-else :key="page.slug" :title="page.title">
    <template #actions>
      <RouterLink v-if="isAdmin()" :to="`/admin/contents/${page.slug}`" class="button secondary">페이지 수정</RouterLink>
    </template>
    <template #notice>
      <p v-if="!page.isPublic" class="applicant-note">🔒 비공개 페이지입니다. 관리자에게만 보입니다.</p>
    </template>
    <MarkdownView v-if="page.body.trim()" :source="page.body" />
    <p v-else class="muted">준비 중입니다.</p>
  </ContentLayout>
</template>
