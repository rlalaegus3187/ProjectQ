<script setup>
// 멤버란: 전체 캐릭터 목록 (대표 프로필 이미지 + 이름)
import { ref, computed, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api } from '../api';

const route = useRoute();
const router = useRouter();
const data = ref(null);
const error = ref('');
const query = ref(String(route.query.q ?? ''));

const page = computed(() => Math.max(1, Number(route.query.page) || 1));
const totalPages = computed(() => (data.value ? Math.max(1, Math.ceil(data.value.total / data.value.pageSize)) : 1));

async function load() {
  error.value = '';
  try {
    const params = new URLSearchParams({ page: String(page.value) });
    if (route.query.q) params.set('q', String(route.query.q));
    data.value = await api(`/members?${params}`);
  } catch (e) {
    error.value = e.message;
  }
}

// 검색/페이지는 주소(query)에 남겨서 뒤로가기·공유가 되도록
function search() {
  router.push({ query: query.value.trim() ? { q: query.value.trim() } : {} });
}
function goPage(n) {
  router.push({ query: { ...route.query, page: n > 1 ? n : undefined } });
}

watch(() => route.fullPath, load, { immediate: true });
</script>

<template>
  <section class="card">
    <div class="card-head">
      <h1>멤버 <span v-if="data" class="muted">{{ data.total }}명</span></h1>
    </div>
    <form class="add-row" @submit.prevent="search">
      <input v-model="query" placeholder="캐릭터 이름으로 검색" />
      <button type="submit" class="secondary">검색</button>
    </form>
    <p v-if="error" class="error">{{ error }}</p>

    <template v-if="data">
      <p v-if="!data.members.length" class="muted">{{ route.query.q ? '검색 결과가 없습니다.' : '아직 캐릭터가 없습니다.' }}</p>
      <ul v-else class="member-grid">
        <li v-for="m in data.members" :key="m.id">
          <RouterLink :to="`/members/${m.id}`" class="member-card">
            <span class="member-thumb">
              <img v-if="m.thumbnail" :src="m.thumbnail" :alt="m.name" loading="lazy" />
              <span v-else class="member-initial">{{ m.name.slice(0, 1) }}</span>
            </span>
            <strong class="member-name">{{ m.name }}</strong>
          </RouterLink>
        </li>
      </ul>

      <nav v-if="totalPages > 1" class="pager">
        <button type="button" class="secondary" :disabled="page <= 1" @click="goPage(page - 1)">이전</button>
        <span>{{ page }} / {{ totalPages }}</span>
        <button type="button" class="secondary" :disabled="page >= totalPages" @click="goPage(page + 1)">다음</button>
      </nav>
    </template>
  </section>
</template>
