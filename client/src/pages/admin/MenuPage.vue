<script setup>
// 관리자: 메뉴 관리 — 상단 메뉴(와 홈 바로가기)에 보일 탭과 순서
// 후보: 콘텐츠 페이지(페이지 관리에서 추가) + 멤버 / 상점 / Q&A. 비공개 페이지도 메뉴에 둘 수 있음 (들어가면 '비공개 페이지입니다')
import { ref, computed, onMounted } from 'vue';
import { api } from '../../api';
import { loadMenu } from '../../menu';

const items = ref([]);
const saved = ref('');
const busy = ref(false);
const error = ref('');
const message = ref('');

const dirty = computed(() => JSON.stringify(items.value) !== saved.value);
const pick = (list) => list.map(({ key, label, to, visible, isPublic, page }) => ({ key, label, to, visible, isPublic, page }));

async function load() {
  items.value = pick((await api('/admin/menu')).menu);
  saved.value = JSON.stringify(items.value);
}

function move(i, d) {
  const j = i + d;
  if (j < 0 || j >= items.value.length) return;
  const list = items.value;
  [list[i], list[j]] = [list[j], list[i]];
}

async function save() {
  busy.value = true;
  error.value = '';
  message.value = '';
  try {
    const body = { menu: items.value.map(({ key, visible }) => ({ key, visible })) };
    items.value = pick((await api('/admin/menu', { method: 'PUT', body })).menu);
    saved.value = JSON.stringify(items.value);
    await loadMenu();   // 상단 메뉴에 바로 반영
    message.value = '메뉴를 저장했습니다.';
  } catch (e) {
    error.value = e.message;
  } finally {
    busy.value = false;
  }
}

onMounted(() => load().catch((e) => { error.value = e.message; }));
</script>

<template>
  <section class="card">
    <h1>메뉴 관리</h1>
    <p class="muted">
      상단 메뉴와 홈 화면 바로가기에 보일 탭을 고르고 순서를 정합니다. 새 탭(페이지)은 <RouterLink to="/admin/contents">페이지 관리</RouterLink>에서 추가합니다.
      비공개 페이지도 메뉴에 둘 수 있으며, 관리자가 아닌 사람이 들어가면 '비공개 페이지입니다'가 보입니다.
    </p>
    <p v-if="error" class="error">{{ error }}</p>
    <p v-if="message" class="ok">{{ message }}</p>

    <ul class="menu-edit">
      <li v-for="(m, i) in items" :key="m.key" :class="{ hidden: !m.visible }">
        <label class="inline">
          <input v-model="m.visible" type="checkbox" :aria-label="`${m.label} 메뉴에 보이기`" />
          <strong>{{ m.label }}</strong>
        </label>
        <span class="muted">{{ m.to }}</span>
        <span v-if="m.page" class="badge">페이지</span>
        <span v-if="m.isPublic === false" class="badge lock">비공개</span>
        <span class="menu-edit-actions">
          <button type="button" class="secondary small" title="위로" :disabled="i === 0" @click="move(i, -1)">↑</button>
          <button type="button" class="secondary small" title="아래로" :disabled="i === items.length - 1" @click="move(i, 1)">↓</button>
        </span>
      </li>
    </ul>

    <div class="actions">
      <button type="button" :disabled="busy || !dirty" @click="save">{{ busy ? '저장 중…' : dirty ? '저장' : '저장됨' }}</button>
      <span class="muted">보이는 탭 {{ items.filter((m) => m.visible).length }}개</span>
    </div>
  </section>
</template>
