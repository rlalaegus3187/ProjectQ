<script setup>
// 달력 한 달 — 날짜 칸마다 그날 걸친 이벤트를 색 막대로 (칸마다 3개까지, 넘치면 +N)
//   <CalendarMonth :year="2026" :month="10" :events="[{ id, title, color, startDate, endDate }]" today="2026-10-11" @select="(e) => ..." />
//   month: 1~12, 날짜는 'YYYY-MM-DD' 문자열 (시간대 영향 없음)
import { computed } from 'vue';

const props = defineProps({
  year: { type: Number, required: true },
  month: { type: Number, required: true },
  events: { type: Array, default: () => [] },
  today: { type: String, default: '' },
});
defineEmits(['select']);

const WEEK = ['일', '월', '화', '수', '목', '금', '토'];
const MAX_PER_DAY = 3;
const pad = (n) => String(n).padStart(2, '0');

// 6주 x 7일 칸 (앞뒤 달 날짜는 흐리게)
const days = computed(() => {
  const first = new Date(Date.UTC(props.year, props.month - 1, 1));
  const start = new Date(first);
  start.setUTCDate(1 - first.getUTCDay());
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setUTCDate(start.getUTCDate() + i);
    const date = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
    const list = props.events.filter((e) => e.startDate <= date && e.endDate >= date);
    return {
      date, day: d.getUTCDate(), weekday: d.getUTCDay(), inMonth: d.getUTCMonth() === props.month - 1,
      events: list.slice(0, MAX_PER_DAY), more: Math.max(0, list.length - MAX_PER_DAY),
    };
  });
});
// 마지막 줄이 통째로 다음 달이면 숨김
const visibleDays = computed(() => (days.value.slice(35).some((d) => d.inMonth) ? days.value : days.value.slice(0, 35)));
// 막대에 이름은 시작하는 날(또는 주의 첫날)에만
const showTitle = (e, d) => e.startDate === d.date || d.weekday === 0;
</script>

<template>
  <div class="cal">
    <div v-for="(w, i) in WEEK" :key="w" class="cal-week" :class="{ sun: i === 0, sat: i === 6 }">{{ w }}</div>
    <div v-for="d in visibleDays" :key="d.date" class="cal-day"
      :class="{ out: !d.inMonth, today: d.date === today, sun: d.weekday === 0, sat: d.weekday === 6 }">
      <span class="cal-num">{{ d.day }}</span>
      <button v-for="e in d.events" :key="e.id" type="button" class="cal-event"
        :class="{ start: e.startDate === d.date, end: e.endDate === d.date }"
        :style="{ '--ev': e.color }" :title="`${e.title} (${e.startDate}${e.endDate !== e.startDate ? ` ~ ${e.endDate}` : ''})`"
        @click="$emit('select', e)">{{ showTitle(e, d) ? e.title : ' ' }}</button>
      <span v-if="d.more" class="cal-more">+{{ d.more }}</span>
    </div>
  </div>
</template>
