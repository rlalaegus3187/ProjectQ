<script setup>
// 관리자: 테마 — client/public/css/<폴더> 의 테마 목록, 미리보기(내 화면에서만), 사이트 전체에 적용
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { api } from '../../api';
import { site, setSite, applyTheme } from '../../site';

const themes = ref([]);
const active = ref('basic');     // 사이트에 적용된 테마
const previewing = ref(null);    // 내 화면에서만 미리보는 테마 id
const busy = ref(false);
const error = ref('');
const message = ref('');

async function load() {
  const data = await api('/admin/themes');
  themes.value = data.themes;
  active.value = data.active;
}

function preview(t) {
  message.value = '';
  previewing.value = t.id;
  applyTheme(t.css, { remember: false });   // 저장하지 않음 — 이 브라우저 화면에서만
}

function stopPreview() {
  previewing.value = null;
  applyTheme(site.theme.css, { remember: false });
}

async function apply(t) {
  if (!confirm(`'${t.name}' 테마를 사이트 전체에 적용할까요?`)) return;
  busy.value = true;
  error.value = '';
  try {
    const s = await api('/admin/settings', { method: 'PUT', body: { siteTheme: t.id } });
    setSite(s);
    active.value = s.siteTheme.id;
    previewing.value = null;
    message.value = `'${t.name}' 테마를 적용했습니다. 방문자는 새로고침하면 바뀐 테마로 보입니다.`;
  } catch (e) {
    error.value = e.message;
  } finally {
    busy.value = false;
  }
}

onMounted(() => load().catch((e) => { error.value = e.message; }));
// 미리보기 중에 다른 메뉴로 가면 원래 테마로
onBeforeUnmount(() => { if (previewing.value) stopPreview(); });
</script>

<template>
  <section class="card">
    <div class="card-head">
      <h1>테마</h1>
      <button v-if="previewing" type="button" class="secondary" @click="stopPreview">미리보기 끝내기</button>
    </div>
    <p class="muted">
      <code>client/public/css/</code> 안의 폴더가 테마입니다. <strong>basic</strong>(기본)은 항상 먼저 적용되고, 고른 테마가 그 위에 덮어씁니다.
      새 테마는 <code>css/테마이름/style.css</code> 를 만들어 배포하면 여기에 나타납니다. (자세한 방법: <code>client/public/css/README.md</code>)
    </p>
    <p v-if="previewing" class="preview-note">미리보기 중 — 내 화면에서만 바뀌었고 사이트에는 적용되지 않았습니다.</p>
    <p v-if="error" class="error">{{ error }}</p>
    <p v-if="message" class="ok">{{ message }}</p>

    <ul class="theme-grid">
      <li v-for="t in themes" :key="t.id" class="theme-card" :class="{ active: t.id === active, previewing: t.id === previewing }">
        <div class="theme-preview">
          <img v-if="t.preview" :src="t.preview" :alt="`${t.name} 미리보기`" />
          <span v-else class="muted">미리보기 그림 없음</span>
        </div>
        <div class="theme-info">
          <strong>{{ t.name }}</strong>
          <span v-if="t.id === active" class="badge answered">적용 중</span>
          <span class="muted theme-dir">/css/{{ t.id }}/</span>
          <p v-if="t.description" class="muted">{{ t.description }}</p>
          <p v-if="t.author" class="muted">만든 사람: {{ t.author }}</p>
        </div>
        <div class="actions">
          <button type="button" class="secondary small" :disabled="t.id === previewing" @click="preview(t)">미리보기</button>
          <button type="button" class="small" :disabled="busy || t.id === active" @click="apply(t)">적용</button>
        </div>
      </li>
    </ul>
  </section>
</template>
