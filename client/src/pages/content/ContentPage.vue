<script setup>
// 콘텐츠 페이지 (공지 / 세계관 / 시스템 / 캐릭터 가이드) — 페이지마다 파일을 두지 않고 이 파일 하나가
// 주소의 slug(/notice, /world ...)로 DB 내용을 불러와 표시. 내용은 관리 → 페이지 관리에서 작성
import { ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { api } from '../../api';
import { isAdmin } from '../../auth';
import { MarkdownView } from '../../markdown';
import { usePageMusic } from '../../music';
import PageContainer from '../../components/PageContainer.vue';

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
  <p v-if="error" class="error">{{ error }}</p>
  <p v-else-if="!page" class="muted">불러오는 중…</p>
  <PageContainer v-else :title="page.title" :description="page.description">
    <template v-if="isAdmin()" #actions>
      <RouterLink :to="`/admin/contents/${page.slug}`" class="button secondary">페이지 수정</RouterLink>
    </template>
    <MarkdownView v-if="page.body.trim()" :source="page.body" />
    <p v-else class="muted">준비 중입니다.</p>
  </PageContainer>
</template>
