<script setup>
// 캘린더 — 주요 이벤트 달력. ‹ › 로 이전·다음 달 (제한 없음), 가운데 ■ 는 오늘이 있는 달로
// 처음엔 GET /api/home 이 보낸 저번달~다음달 이벤트를 쓰고, 그 밖의 달로 넘기면 GET /api/home/events?month= 로 불러옴
// (한 번 불러온 달은 기억 → 다시 와도 바로). 달력 아래에 그 달 이벤트 목록, 이벤트를 누르면 설명
// 이벤트 관리는 관리 → 메인페이지 관리 → 캘린더 관리
import { ref, computed, watch } from 'vue';
import { api } from '../api';
import CalendarMonth from './CalendarMonth.vue';
import ModalDialog from '../components/ModalDialog.vue';

const props = defineProps({ data: { type: Object, default: null } });
const pad = (n) => String(n).padStart(2, '0');
const key = (y, m) => `${y}-${pad(m)}`;

const today = computed(() => props.data?.today || new Date().toISOString().slice(0, 10));
const [ty, tm] = today.value.split('-').map(Number);
const view = ref({ year: ty, month: tm });   // 보고 있는 달 (month: 1~12)
const isTodayMonth = computed(() => view.value.year === ty && view.value.month === tm);

// 불러온 이벤트 (id → 이벤트) + 불러온 달
const byId = ref(new Map());
const loaded = ref(new Set());
const loading = ref(false);
const error = ref('');
function addEvents(list) {
  const next = new Map(byId.value);
  for (const e of list) next.set(e.id, e);
  byId.value = next;
}
// 처음 받은 범위(저번달~다음달)는 이미 있음
(function seed() {
  addEvents(props.data?.events || []);
  for (let d = -1; d <= 1; d += 1) {
    const x = new Date(Date.UTC(ty, tm - 1 + d, 1));
    loaded.value.add(key(x.getUTCFullYear(), x.getUTCMonth() + 1));
  }
}());
const events = computed(() => [...byId.value.values()]);

async function ensureMonth({ year, month }) {
  const k = key(year, month);
  if (loaded.value.has(k)) return;
  loading.value = true;
  error.value = '';
  try {
    addEvents((await api(`/home/events?month=${k}`)).events);
    loaded.value = new Set(loaded.value).add(k);
  } catch (e) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
}
watch(view, (v) => ensureMonth(v));

function go(step) {
  const d = new Date(Date.UTC(view.value.year, view.value.month - 1 + step, 1));
  view.value = { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 };
}
const goToday = () => { view.value = { year: ty, month: tm }; };

// 이 달과 겹치는 이벤트
const monthEvents = computed(() => {
  const { year, month } = view.value;
  const from = `${key(year, month)}-01`;
  const to = `${key(year, month)}-31`;
  return events.value.filter((e) => e.startDate <= to && e.endDate >= from).sort((a, b) => a.startDate.localeCompare(b.startDate));
});
const short = (d) => d.slice(5).replace('-', '/');
const period = (e) => (e.endDate === e.startDate ? short(e.startDate) : `${short(e.startDate)} ~ ${short(e.endDate)}`);
const selected = ref(null);
</script>

<template>
  <section class="card home-calendar">
    <div class="card-head">
      <h2>{{ view.year }}년 {{ view.month }}월</h2>
      <div class="home-cal-nav">
        <button type="button" aria-label="이전 달" title="이전 달" @click="go(-1)">‹</button>
        <button type="button" class="today" aria-label="오늘" title="오늘이 있는 달로" :disabled="isTodayMonth" @click="goToday" />
        <button type="button" aria-label="다음 달" title="다음 달" @click="go(1)">›</button>
      </div>
    </div>
    <CalendarMonth :year="view.year" :month="view.month" :events="events" :today="today" @select="selected = $event" />
    <p v-if="error" class="error home-cal-empty">{{ error }}</p>
    <p v-else-if="loading" class="muted home-cal-empty">불러오는 중…</p>
    <ul v-else-if="monthEvents.length" class="home-cal-list">
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
