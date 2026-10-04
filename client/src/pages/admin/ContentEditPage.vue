<script setup>
// 관리자: 페이지 관리 — 공지·세계관 등 콘텐츠 페이지와 그 안의 소탭(섹션) 작성
// 탭으로 페이지를 고르고(주소 /admin/contents/<slug>), 소탭마다 제목 + 마크다운 내용. 새 페이지 추가 / 페이지 삭제
// 상단 메뉴에 보일지는 관리 → 메뉴 관리에서 (새 페이지를 만들 때도 고를 수 있음)
import { ref, computed, watch, onMounted } from 'vue';
import { useRoute, useRouter, onBeforeRouteLeave } from 'vue-router';
import { api } from '../../api';
import { loadMenu } from '../../menu';
import { MarkdownEditor } from '../../markdown';
import { parseYouTubeId, youtubeUrl } from '../../music';
import { formatDate } from '../../boards';
import ModalDialog from '../../components/ModalDialog.vue';

const route = useRoute();
const router = useRouter();
const pages = ref([]);
const form = ref(null);       // 편집 중인 값 { title, description, music, isPublic, sections: [{ id?, key, title, body }] }
const saved = ref('');        // 마지막으로 저장된 값 (JSON) — 바뀐 게 있는지 비교
const saving = ref(false);
const error = ref('');
const message = ref('');
const creating = ref(null);   // 새 페이지 팝업 { slug, title, showInMenu }
let newKey = 0;

const current = computed(() => pages.value.find((p) => p.slug === route.params.slug) ?? null);
const dirty = computed(() => form.value && JSON.stringify(form.value) !== saved.value);
const musicInvalid = computed(() => !!form.value?.music && !parseYouTubeId(form.value.music));

const toForm = (p) => ({
  title: p.title,
  description: p.description,
  music: youtubeUrl(p.musicVideoId),
  isPublic: p.isPublic,
  sections: p.sections.map((s) => ({ id: s.id, key: `s${s.id}`, title: s.title, body: s.body })),
});

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

// ---------- 소탭 ----------
function addSection() {
  newKey += 1;
  form.value.sections.push({ id: null, key: `new${newKey}`, title: '', body: '' });
}
function moveSection(i, d) {
  const list = form.value.sections;
  const j = i + d;
  if (j < 0 || j >= list.length) return;
  [list[i], list[j]] = [list[j], list[i]];
}
function removeSection(i) {
  const s = form.value.sections[i];
  if ((s.title || s.body) && !confirm(`'${s.title || '제목 없음'}' 소탭을 지울까요? (저장해야 반영)`)) return;
  form.value.sections.splice(i, 1);
}

async function save() {
  error.value = '';
  message.value = '';
  saving.value = true;
  try {
    const body = { ...form.value, sections: form.value.sections.map(({ id, title, body: text }) => ({ id, title, body: text })) };
    const { page } = await api(`/admin/contents/${current.value.slug}`, { method: 'PUT', body });
    pages.value = pages.value.map((p) => (p.slug === page.slug ? page : p));
    form.value = toForm(page);
    saved.value = JSON.stringify(form.value);
    loadMenu();   // 상단 메뉴 이름·공개 표시도 바로 반영
    message.value = `'${page.title}' 페이지를 저장했습니다.`;
  } catch (e) {
    error.value = e.message;
  } finally {
    saving.value = false;
  }
}

// ---------- 페이지 추가 / 삭제 ----------
async function createPage() {
  error.value = '';
  try {
    const { page } = await api('/admin/contents', { method: 'POST', body: creating.value });
    creating.value = null;
    await loadMenu();
    pages.value = (await api('/admin/contents')).pages;
    saved.value = JSON.stringify(form.value);   // 이동 경고 없이
    await router.push(`/admin/contents/${page.slug}`);
    message.value = `'${page.title}' 페이지를 만들었습니다. 소탭을 추가해서 내용을 작성하세요.`;
  } catch (e) {
    creating.value.error = e.message;
  }
}

async function removePage() {
  const p = current.value;
  if (!confirm(`'${p.title}' 페이지(/${p.slug})를 삭제할까요?\n소탭 ${p.sections.length}개도 함께 삭제되고 메뉴에서도 빠집니다. 되돌릴 수 없습니다.`)) return;
  try {
    await api(`/admin/contents/${p.slug}`, { method: 'DELETE' });
    saved.value = JSON.stringify(form.value);
    await loadMenu();
    pages.value = (await api('/admin/contents')).pages;
    await router.replace(pages.value[0] ? `/admin/contents/${pages.value[0].slug}` : '/admin/contents');
    open();
    message.value = `'${p.title}' 페이지를 삭제했습니다.`;
  } catch (e) {
    error.value = e.message;
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
      <div class="actions">
        <RouterLink v-if="current" :to="`/${current.slug}`" class="button secondary">페이지 보기</RouterLink>
        <button type="button" @click="creating = { slug: '', title: '', showInMenu: true, error: '' }">+ 새 페이지</button>
      </div>
    </div>
    <p class="muted">
      페이지마다 <strong>소탭</strong>을 여러 개 만들 수 있습니다. 페이지 화면 왼쪽에 소탭 목록이 보이고, 누르면 그 소탭으로 스크롤됩니다.
      상단 메뉴에 보일 페이지와 순서는 <RouterLink to="/admin/menu">메뉴 관리</RouterLink>에서 정합니다.
    </p>

    <div class="tabs profile-tabs" role="tablist">
      <button v-for="p in pages" :key="p.slug" type="button" role="tab" :aria-selected="p.slug === current?.slug"
        :class="{ active: p.slug === current?.slug }" @click="selectTab(p.slug)">
        {{ p.title }}<span v-if="!p.isPublic" title="비공개"> 🔒</span>
      </button>
    </div>

    <p v-if="!pages.length && !error" class="muted">페이지가 없습니다. [+ 새 페이지]로 만들어주세요.</p>
    <form v-else-if="form" class="form" @submit.prevent="save">
      <fieldset class="fieldset">
        <legend>페이지 <span class="muted">/{{ current.slug }}</span></legend>
        <div class="field">
          <label for="page-title">제목 <span class="muted">(메뉴 이름)</span></label>
          <input id="page-title" v-model="form.title" required maxlength="100" />
        </div>
        <div class="field">
          <label for="page-desc">설명 <span class="muted">(제목 아래 한 줄, 선택)</span></label>
          <input id="page-desc" v-model="form.description" maxlength="255" />
        </div>
        <div class="field">
          <label for="page-music">페이지 음악 <span class="muted">(유튜브 링크, 비우면 사이트 음악)</span></label>
          <input id="page-music" v-model="form.music" type="url" maxlength="300" placeholder="https://www.youtube.com/watch?v=…" :class="{ invalid: musicInvalid }" />
          <span v-if="musicInvalid" class="error">유튜브 영상 링크가 아닙니다.</span>
        </div>
        <label class="switch-row">
          <span class="switch">
            <input v-model="form.isPublic" type="checkbox" role="switch" :aria-checked="form.isPublic" />
            <span class="slider" />
          </span>
          <span>
            공개 <strong :class="form.isPublic ? 'on' : 'off'">{{ form.isPublic ? '공개' : '비공개' }}</strong>
            <span class="muted">— 비공개면 관리자만 볼 수 있습니다. 메뉴에 있어도 다른 사람은 '비공개 페이지입니다'만 보입니다.</span>
          </span>
        </label>
      </fieldset>

      <h2 class="section-title">소탭 {{ form.sections.length }}개</h2>
      <p v-if="!form.sections.length" class="muted">소탭이 없습니다. 아래 [+ 소탭 추가]로 내용을 작성하세요.</p>
      <fieldset v-for="(s, i) in form.sections" :key="s.key" class="fieldset section-edit">
        <legend>소탭 {{ i + 1 }}<template v-if="s.title"> · {{ s.title }}</template></legend>
        <div class="section-edit-head">
          <input v-model="s.title" required maxlength="100" placeholder="소탭 제목 (왼쪽 목록에 보임)" :aria-label="`소탭 ${i + 1} 제목`" />
          <button type="button" class="secondary small" title="위로" :disabled="i === 0" @click="moveSection(i, -1)">↑</button>
          <button type="button" class="secondary small" title="아래로" :disabled="i === form.sections.length - 1" @click="moveSection(i, 1)">↓</button>
          <button type="button" class="danger small" @click="removeSection(i)">삭제</button>
        </div>
        <MarkdownEditor v-model="s.body" :rows="10" :maxlength="100000" />
      </fieldset>
      <div>
        <button type="button" class="secondary" @click="addSection">+ 소탭 추가</button>
      </div>

      <p v-if="error" class="error">{{ error }}</p>
      <p v-if="message" class="ok">{{ message }}</p>
      <div class="actions">
        <span v-if="current?.updatedAt" class="muted">마지막 저장 {{ formatDate(current.updatedAt) }}</span>
        <button type="submit" :disabled="saving || !dirty || musicInvalid">{{ saving ? '저장 중…' : dirty ? '저장' : '저장됨' }}</button>
        <button type="button" class="danger" @click="removePage">페이지 삭제</button>
      </div>
    </form>
    <p v-else-if="error" class="error">{{ error }}</p>
  </section>

  <ModalDialog v-if="creating" title="새 페이지" @close="creating = null">
    <form class="form" @submit.prevent="createPage">
      <fieldset class="fieldset">
        <legend>페이지</legend>
        <div class="field">
          <label for="new-title">제목 (메뉴 이름)</label>
          <input id="new-title" v-model="creating.title" required maxlength="100" placeholder="예: 이벤트" />
        </div>
        <div class="field">
          <label for="new-slug">주소 <span class="muted">(영문 소문자·숫자·-, 만든 뒤 바꿀 수 없음)</span></label>
          <div class="slug-input"><span class="muted">/</span><input id="new-slug" v-model="creating.slug" required pattern="[a-z][a-z0-9\-]{1,29}" maxlength="30" placeholder="event" /></div>
        </div>
        <label class="inline"><input v-model="creating.showInMenu" type="checkbox" /> 상단 메뉴에 보이기</label>
      </fieldset>
      <p v-if="creating.error" class="error">{{ creating.error }}</p>
      <div class="actions">
        <button type="submit">만들기</button>
        <button type="button" class="secondary" @click="creating = null">취소</button>
      </div>
    </form>
  </ModalDialog>
</template>
