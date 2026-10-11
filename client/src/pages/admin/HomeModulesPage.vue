<script setup>
// 관리자: 메인페이지 관리 → 메인페이지 설정 — 메인(/)에 보일 모듈과 순서 (켜기/끄기는 여기서만)
// 모듈마다 내용 관리는 소탭(배너 관리, 캘린더 관리)
import { ref, computed, onMounted } from 'vue';
import { api } from '../../api';
import ToggleSwitch from '../../components/ToggleSwitch.vue';

// 내용을 관리하는 소탭이 있는 모듈
const MANAGE = { banner: '/admin/home/banners', calendar: '/admin/home/calendar' };

const items = ref([]);
const saved = ref('');
const busy = ref(false);
const error = ref('');
const message = ref('');
const dirty = computed(() => JSON.stringify(items.value) !== saved.value);

function apply(list) {
  items.value = list.map(({ key, label, description, visible }) => ({ key, label, description, visible }));
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
    const body = { modules: items.value.map(({ key, visible }) => ({ key, visible })) };
    apply((await api('/admin/home/modules', { method: 'PUT', body })).modules);
    message.value = '메인페이지 설정을 저장했습니다.';
  } catch (e) {
    error.value = e.message;
  } finally {
    busy.value = false;
  }
}

onMounted(() => api('/admin/home/modules').then((r) => apply(r.modules)).catch((e) => { error.value = e.message; }));
</script>

<template>
  <section class="card">
    <div class="card-head">
      <h1>메인페이지 설정</h1>
      <RouterLink to="/" class="button secondary">메인 보기</RouterLink>
    </div>
    <p class="muted">메인 화면에 보일 모듈을 켜고, ↑↓ 로 순서를 정한 뒤 저장하세요. 위에 있을수록 화면 앞(위)에 보입니다.</p>
    <p v-if="error" class="error">{{ error }}</p>
    <p v-if="message" class="ok">{{ message }}</p>

    <ul class="menu-edit home-modules">
      <li v-for="(m, i) in items" :key="m.key" :class="{ hidden: !m.visible }">
        <label class="toggle">
          <ToggleSwitch v-model="m.visible" :label="`${m.label} 보이기`" />
          <strong>{{ m.label }}</strong>
        </label>
        <span class="muted">{{ m.description }}</span>
        <RouterLink v-if="MANAGE[m.key]" :to="MANAGE[m.key]" class="small-link">내용 관리</RouterLink>
        <span class="menu-edit-actions">
          <button type="button" class="secondary small" title="위로" :disabled="i === 0" @click="move(i, -1)">↑</button>
          <button type="button" class="secondary small" title="아래로" :disabled="i === items.length - 1" @click="move(i, 1)">↓</button>
        </span>
      </li>
    </ul>
    <div class="actions">
      <button type="button" :disabled="busy || !dirty" @click="save">{{ busy ? '저장 중…' : dirty ? '저장' : '저장됨' }}</button>
    </div>
  </section>
</template>
