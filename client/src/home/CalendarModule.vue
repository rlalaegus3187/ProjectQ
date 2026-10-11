<script setup>
// 캘린더 — 주요 이벤트 달력. 보여줄 달(저번달 · 이번달 · 다음달, 오늘 기준)은 관리 → 메인페이지 관리 → 캘린더 관리
// 달 탭을 고르면 그 달 달력 + 아래에 그 달 이벤트 목록, 이벤트를 누르면 설명
import { ref, computed } from 'vue';
import CalendarMonth from './CalendarMonth.vue';
import ModalDialog from '../components/ModalDialog.vue';

const props = defineProps({ data: { type: Object, default: null } });
const OFFSET = { prev: -1, current: 0, next: 1 };
const LABEL = { prev: '저번달', current: '이번달', next: '다음달' };

const today = computed(() => props.data?.today || new Date().toISOString().slice(0, 10));
const events = computed(() => props.data?.events || []);
const months = computed(() => (props.data?.months || ['current']).map((key) => {
  const [y, m] = today.value.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + OFFSET[key], 1));
  return { key, label: LABEL[key], year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 };
}));
const selectedKey = ref(null);
const current = computed(() => months.value.find((m) => m.key === selectedKey.value)
  || months.value.find((m) => m.key === 'current') || months.value[0]);

// 이 달과 겹치는 이벤트
const monthEvents = computed(() => {
  const c = current.value;
  if (!c) return [];
  const from = `${c.year}-${String(c.month).padStart(2, '0')}-01`;
  const to = `${c.year}-${String(c.month).padStart(2, '0')}-31`;
  return events.value.filter((e) => e.startDate <= to && e.endDate >= from);
});
const period = (e) => (e.endDate === e.startDate ? e.startDate.slice(5).replace('-', '/') : `${e.startDate.slice(5).replace('-', '/')} ~ ${e.endDate.slice(5).replace('-', '/')}`);
const selected = ref(null);
</script>

<template>
  <section v-if="current" class="card home-calendar">
    <div class="card-head">
      <h2>{{ current.year }}년 {{ current.month }}월</h2>
      <div v-if="months.length > 1" class="home-cal-tabs" role="tablist">
        <button v-for="m in months" :key="m.key" type="button" role="tab" :aria-selected="m.key === current.key"
          :class="{ active: m.key === current.key }" @click="selectedKey = m.key">{{ m.label }}</button>
      </div>
    </div>
    <CalendarMonth :year="current.year" :month="current.month" :events="events" :today="today" @select="selected = $event" />
    <ul v-if="monthEvents.length" class="home-cal-list">
      <li v-for="e in monthEvents" :key="e.id">
        <button type="button" class="link" @click="selected = e">
          <span class="cal-dot" :style="{ background: e.color }" /><strong>{{ e.title }}</strong>
          <span class="muted">{{ period(e) }}</span>
        </button>
      </li>
    </ul>
    <p v-else class="muted home-cal-empty">이 달에는 등록된 이벤트가 없습니다.</p>
  </section>

  <ModalDialog v-if="selected" :title="selected.title" @close="selected = null">
    <p><span class="cal-dot" :style="{ background: selected.color }" />
      {{ selected.startDate }}<template v-if="selected.endDate !== selected.startDate"> ~ {{ selected.endDate }}</template></p>
    <p v-if="selected.description" class="home-cal-desc">{{ selected.description }}</p>
    <p v-else class="muted">추가 설명이 없습니다.</p>
  </ModalDialog>
</template>
