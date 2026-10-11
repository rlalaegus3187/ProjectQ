<script setup>
// 관리자: 메인페이지 관리 → 캘린더 관리 — 주요 이벤트(이름 · 기간 · 설명 · 색) + 메인에 보여줄 달(오늘 기준)
// 메인에 캘린더를 보일지는 '메인페이지 설정'
import { ref, computed, onMounted } from 'vue';
import { api } from '../../api';
import ModalDialog from '../../components/ModalDialog.vue';
import CalendarMonth from '../../home/CalendarMonth.vue';

const COLORS = ['#2563eb', '#dc2626', '#16a34a', '#d97706', '#7c3aed', '#db2777', '#0891b2', '#4b5563'];
const MONTH_OPTIONS = [
  { key: 'prev', label: '저번달' },
  { key: 'current', label: '이번달' },
  { key: 'next', label: '다음달' },
];
const pad = (n) => String(n).padStart(2, '0');
const now = new Date();
const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

const events = ref([]);
const months = ref([]);
const savedMonths = ref('');
const filter = ref('upcoming');   // upcoming(진행 중·다가오는) / past(지난) / all
const error = ref('');
const message = ref('');
const editing = ref(null);   // { id?, title, startDate, endDate, color, description, error }
const saving = ref(false);
const preview = ref({ year: now.getFullYear(), month: now.getMonth() + 1 });

function flash(text) {
  message.value = text;
  setTimeout(() => { if (message.value === text) message.value = ''; }, 3000);
}
function apply(res) {
  events.value = res.events;
  months.value = [...res.months];
  savedMonths.value = JSON.stringify(res.months);
}
const monthsDirty = computed(() => JSON.stringify(MONTH_OPTIONS.map((o) => o.key).filter((k) => months.value.includes(k))) !== savedMonths.value);

const shown = computed(() => {
  const list = events.value;
  if (filter.value === 'upcoming') return list.filter((e) => e.endDate >= today).sort((a, b) => a.startDate.localeCompare(b.startDate));
  if (filter.value === 'past') return list.filter((e) => e.endDate < today);
  return list;
});
const period = (e) => (e.endDate === e.startDate ? e.startDate : `${e.startDate} ~ ${e.endDate}`);

async function saveMonths() {
  error.value = '';
  try {
    apply(await api('/admin/home/calendar', { method: 'PUT', body: { months: months.value } }));
    flash('보여줄 달을 저장했습니다.');
  } catch (e) {
    error.value = e.message;
  }
}

function newEvent(date = today) {
  editing.value = { title: '', startDate: date, endDate: date, color: COLORS[0], description: '', error: '' };
}
const editEvent = (e) => { editing.value = { ...e, error: '' }; };
async function save() {
  const { id, title, startDate, endDate, color, description } = editing.value;
  editing.value.error = '';
  saving.value = true;
  try {
    const body = { title, startDate, endDate: endDate || startDate, color, description };
    apply(id ? await api(`/admin/home/events/${id}`, { method: 'PUT', body }) : await api('/admin/home/events', { method: 'POST', body }));
    flash(`'${title}' 이벤트를 ${id ? '수정' : '추가'}했습니다.`);
    editing.value = null;
  } catch (e) {
    editing.value.error = e.message;
  } finally {
    saving.value = false;
  }
}
async function remove(e) {
  if (!confirm(`'${e.title}' 이벤트를 삭제할까요?`)) return;
  try {
    apply(await api(`/admin/home/events/${e.id}`, { method: 'DELETE' }));
    flash(`'${e.title}' 이벤트를 삭제했습니다.`);
    if (editing.value?.id === e.id) editing.value = null;
  } catch (err) {
    error.value = err.message;
  }
}
function movePreview(d) {
  const m = preview.value.month - 1 + d;
  preview.value = { year: preview.value.year + Math.floor(m / 12), month: ((m % 12) + 12) % 12 + 1 };
}

onMounted(() => api('/admin/home/calendar').then(apply).catch((e) => { error.value = e.message; }));
</script>

<template>
  <section class="card">
    <div class="card-head">
      <h1>캘린더 관리</h1>
      <button type="button" @click="newEvent()">새 이벤트</button>
    </div>
    <p class="muted">메인 캘린더에 보일 주요 이벤트를 관리합니다. 메인에 캘린더를 보일지는 <RouterLink to="/admin/home/modules">메인페이지 설정</RouterLink>에서.</p>
    <p v-if="error" class="error">{{ error }}</p>
    <p v-if="message" class="ok">{{ message }}</p>

    <div class="cal-months-setting">
      <strong>메인에 보여줄 달</strong> <span class="muted">(오늘 기준)</span>
      <label v-for="o in MONTH_OPTIONS" :key="o.key" class="inline"><input v-model="months" type="checkbox" :value="o.key" /> {{ o.label }}</label>
      <button type="button" class="small" :disabled="!monthsDirty || !months.length" @click="saveMonths">저장</button>
      <span v-if="!months.length" class="error">하나 이상 골라주세요.</span>
    </div>
  </section>

  <section class="card">
    <div class="card-head">
      <h2>{{ preview.year }}년 {{ preview.month }}월 <span class="muted">미리보기 — 날짜 칸의 막대를 누르면 수정</span></h2>
      <span class="actions small">
        <button type="button" class="secondary" @click="movePreview(-1)">‹ 이전</button>
        <button type="button" class="secondary" @click="preview = { year: now.getFullYear(), month: now.getMonth() + 1 }">오늘</button>
        <button type="button" class="secondary" @click="movePreview(1)">다음 ›</button>
      </span>
    </div>
    <CalendarMonth :year="preview.year" :month="preview.month" :events="events" :today="today" @select="editEvent" />
  </section>

  <section class="card">
    <div class="card-head">
      <h2>이벤트 목록</h2>
      <div class="tabs profile-tabs" role="tablist">
        <button v-for="f in [['upcoming', '진행 중 · 다가오는'], ['past', '지난'], ['all', '전체']]" :key="f[0]" type="button" role="tab"
          :aria-selected="filter === f[0]" :class="{ active: filter === f[0] }" @click="filter = f[0]">{{ f[1] }}</button>
      </div>
    </div>
    <p v-if="!shown.length" class="muted">이벤트가 없습니다.</p>
    <div v-else class="table-wrap">
      <table class="table">
        <thead><tr><th>색</th><th>이름</th><th>기간</th><th>설명</th><th></th></tr></thead>
        <tbody>
          <tr v-for="e in shown" :key="e.id">
            <td><span class="cal-dot" :style="{ background: e.color }" /></td>
            <td class="title-cell"><strong>{{ e.title }}</strong></td>
            <td>{{ period(e) }}</td>
            <td class="title-cell muted">{{ e.description.length > 60 ? `${e.description.slice(0, 60)}…` : e.description }}</td>
            <td class="row-actions">
              <button type="button" class="secondary" @click="editEvent(e)">수정</button>
              <button type="button" class="danger" @click="remove(e)">삭제</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>

  <ModalDialog v-if="editing" :title="editing.id ? '이벤트 수정' : '새 이벤트'" @close="editing = null">
    <template #actions>
      <button type="submit" form="event-form" :disabled="saving">{{ saving ? '저장 중…' : '저장' }}</button>
      <button v-if="editing.id" type="button" class="danger" @click="remove(editing)">삭제</button>
      <button type="button" class="secondary" @click="editing = null">취소</button>
    </template>
    <form id="event-form" class="form" @submit.prevent="save">
      <fieldset class="fieldset">
        <legend>이벤트</legend>
        <div class="field">
          <label for="ev-title">이름<span class="req">*</span></label>
          <input id="ev-title" v-model="editing.title" required maxlength="100" placeholder="예: 1차 이벤트" />
        </div>
        <div class="field">
          <span>기간<span class="req">*</span> <span class="muted">(하루짜리면 끝나는 날을 같게)</span></span>
          <div class="cal-range">
            <input v-model="editing.startDate" type="date" required aria-label="시작하는 날" @change="editing.endDate < editing.startDate && (editing.endDate = editing.startDate)" />
            <span class="muted">~</span>
            <input v-model="editing.endDate" type="date" :min="editing.startDate" required aria-label="끝나는 날" />
          </div>
        </div>
        <div class="field">
          <span>색</span>
          <div class="cal-colors">
            <button v-for="c in COLORS" :key="c" type="button" class="cal-swatch" :class="{ active: editing.color === c }"
              :style="{ background: c }" :aria-label="`색 ${c}`" @click="editing.color = c" />
            <input v-model="editing.color" type="color" aria-label="직접 고르기" />
          </div>
        </div>
        <div class="field">
          <label for="ev-desc">추가 설명 <span class="muted">(이벤트를 누르면 보임)</span></label>
          <textarea id="ev-desc" v-model="editing.description" rows="4" maxlength="2000" />
        </div>
      </fieldset>
      <p v-if="editing.error" class="error">{{ editing.error }}</p>
    </form>
  </ModalDialog>
</template>
