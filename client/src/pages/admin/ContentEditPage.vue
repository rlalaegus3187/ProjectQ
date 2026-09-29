<script setup>
// 관리자: 페이지 관리 — 공지 / 세계관 / 시스템 / 캐릭터 가이드 내용을 여기 하나에서 작성
// 탭으로 페이지를 고르고(주소 /admin/contents/<slug>), 마크다운으로 작성 → 각 페이지에 그대로 표시
import { ref, computed, watch, onMounted } from 'vue';
import { useRoute, useRouter, onBeforeRouteLeave } from 'vue-router';
import { api } from '../../api';
import { contentTitles } from '../../contents';
import { MarkdownEditor } from '../../markdown';
import { parseYouTubeId, youtubeUrl } from '../../music';
import { formatDate } from '../../boards';

const route = useRoute();
const router = useRouter();
const pages = ref([]);
const form = ref(null);       // 편집 중인 값 { title, description, body, music }
const saved = ref('');        // 마지막으로 저장된 값 (JSON) — 바뀐 게 있는지 비교
const saving = ref(false);
const error = ref('');
const message = ref('');

const current = computed(() => pages.value.find((p) => p.slug === route.params.slug) ?? null);
const dirty = computed(() => form.value && JSON.stringify(form.value) !== saved.value);
const musicInvalid = computed(() => !!form.value?.music && !parseYouTubeId(form.value.music));

const toForm = (p) => ({ title: p.title, description: p.description, body: p.body, music: youtubeUrl(p.musicVideoId) });

function open() {
  message.value = '';
  error.value = '';
  if (!current.value) { form.value = null; return; }
  form.value = toForm(current.value);
  saved.value = JSON.stringify(form.value);
}

const confirmLeave = () => !dirty.value || confirm('저장하지 않은 내용이 있습니다. 이동할까요?');

async function load() {
  pages.value = (await api('/admin/contents')).pages;
  // 주소에 페이지가 없으면 첫 페이지로
  if (!current.value && pages.value[0]) {
    await router.replace(`/admin/contents/${pages.value[0].slug}`);
  }
  open();
}

async function save() {
  error.value = '';
  message.value = '';
  saving.value = true;
  try {
    const { page } = await api(`/admin/contents/${current.value.slug}`, { method: 'PUT', body: form.value });
    pages.value = pages.value.map((p) => (p.slug === page.slug ? page : p));
    contentTitles[page.slug] = page.title;   // 상단 메뉴 이름도 바로 반영
    form.value = toForm(page);
    saved.value = JSON.stringify(form.value);
    message.value = `'${page.title}' 페이지를 저장했습니다.`;
  } catch (e) {
    error.value = e.message;
  } finally {
    saving.value = false;
  }
}

// 탭 이동 / 다른 메뉴로 이동할 때 저장 안 한 내용이 있으면 확인
onBeforeRouteLeave(confirmLeave);
function selectTab(slug) {
  if (slug === route.params.slug || !confirmLeave()) return;
  saved.value = JSON.stringify(form.value);   // 확인했으면 경고 다시 안 띄움
  router.push(`/admin/contents/${slug}`);
}

watch(() => route.params.slug, () => { if (pages.value.length) open(); });
onMounted(() => load().catch((e) => { error.value = e.message; }));
</script>

<template>
  <section class="card">
    <div class="card-head">
      <h1>페이지 관리</h1>
      <RouterLink v-if="current" :to="`/${current.slug}`" class="button secondary">페이지 보기</RouterLink>
    </div>
    <p class="muted">공지·세계관·시스템·캐릭터 가이드의 내용을 작성합니다. 저장하면 각 페이지에 바로 보입니다.</p>

    <div class="tabs profile-tabs" role="tablist">
      <button v-for="p in pages" :key="p.slug" type="button" role="tab" :aria-selected="p.slug === current?.slug"
        :class="{ active: p.slug === current?.slug }" @click="selectTab(p.slug)">
        {{ p.title }}
      </button>
    </div>

    <p v-if="!form && !error" class="muted">불러오는 중…</p>
    <form v-else-if="form" class="form" @submit.prevent="save">
      <div class="two-col">
        <label class="field">
          제목 <span class="muted">(메뉴 이름)</span>
          <input v-model="form.title" required maxlength="100" />
        </label>
        <label class="field">
          설명 <span class="muted">(제목 아래 한 줄, 선택)</span>
          <input v-model="form.description" maxlength="255" />
        </label>
      </div>
      <label class="field">
        <span>페이지 음악 <span class="muted">(유튜브 링크, 비우면 사이트 음악)</span></span>
        <input v-model="form.music" type="url" maxlength="300" placeholder="https://www.youtube.com/watch?v=…" :class="{ invalid: musicInvalid }" />
        <span v-if="musicInvalid" class="error">유튜브 영상 링크가 아닙니다.</span>
      </label>
      <div class="field">
        <span>내용</span>
        <MarkdownEditor v-model="form.body" :rows="22" :maxlength="100000" />
      </div>
      <p v-if="error" class="error">{{ error }}</p>
      <p v-if="message" class="ok">{{ message }}</p>
      <div class="actions">
        <span v-if="current?.updatedAt" class="muted">마지막 저장 {{ formatDate(current.updatedAt) }}</span>
        <button type="submit" :disabled="saving || !dirty || musicInvalid">{{ saving ? '저장 중…' : dirty ? '저장' : '저장됨' }}</button>
      </div>
    </form>
    <p v-else class="error">{{ error }}</p>
  </section>
</template>
