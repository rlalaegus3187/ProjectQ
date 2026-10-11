<script setup>
// 메인 (/) — 관리 → 메인페이지 관리에서 켠 모듈을 정한 순서대로 (모듈 화면은 client/src/home/)
import { ref, onMounted } from 'vue';
import { api } from '../../api';
import { HOME_MODULES } from '../../home/modules';

const modules = ref(null);   // [{ key }]
const data = ref({});

onMounted(async () => {
  try {
    const res = await api('/home');
    modules.value = res.modules.filter((m) => HOME_MODULES[m.key]);
    data.value = res.data;
  } catch {
    modules.value = [{ key: 'welcome' }, { key: 'menu' }];   // 못 불러오면 기본 화면
  }
});
</script>

<template>
  <div v-if="modules" class="home">
    <component :is="HOME_MODULES[m.key]" v-for="m in modules" :key="m.key" :data="data[m.key] || null" />
  </div>
</template>
