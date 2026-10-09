<script setup>
// 관리자: 아이템 관리 → 아이템 목록 — 아이템 등록/수정/삭제, 검색·정렬·효과별 보기, 일괄 변경
import { ref, computed, onMounted } from 'vue';
import { api } from '../../api';
import { itemEffects, loadItemEffects, effectLabel, formatEffectValues } from '../../items';
import { MarkdownEditor } from '../../markdown';
import ImageField from '../../components/ImageField.vue';
import ModalDialog from '../../components/ModalDialog.vue';
import BulkBar from '../../components/BulkBar.vue';
import ToggleSwitch from '../../components/ToggleSwitch.vue';
import { useSelection } from '../../selection';

const items = ref([]);
const error = ref('');
const message = ref('');

function flash(text) {
  message.value = text;
  setTimeout(() => { if (message.value === text) message.value = ''; }, 2500);
}

async function loadItems() {
  items.value = (await api('/admin/items')).items;
}

// ---------- 검색 · 정렬 · 효과별 ----------
const SORTS = [
  { value: 'new', label: '최근 만든 순 (uid ↓)' },
  { value: 'old', label: '먼저 만든 순 (uid ↑)' },
  { value: 'name', label: '가나다순' },
  { value: 'name_desc', label: '가나다 역순' },
];
const query = ref('');
const sort = ref('new');
const effectFilter = ref('');   // '' = 전체

const byName = (a, b) => a.name.localeCompare(b.name, 'ko') || a.id - b.id;
const SORTERS = {
  new: (a, b) => b.id - a.id,
  old: (a, b) => a.id - b.id,
  name: byName,
  name_desc: (a, b) => byName(b, a),
};

// 검색어: 이름 · 설명 · uid (숫자만 쓰면 uid 도 찾음)
const shown = computed(() => {
  const q = query.value.trim().toLowerCase();
  return items.value
    .filter((i) => !effectFilter.value || i.effect === effectFilter.value)
    .filter((i) => !q || i.name.toLowerCase().includes(q) || i.description.toLowerCase().includes(q) || String(i.id) === q)
    .sort(SORTERS[sort.value]);
});
const filtered = computed(() => !!query.value.trim() || !!effectFilter.value);
function resetFilters() {
  query.value = '';
  effectFilter.value = '';
  sort.value = 'new';
}

// ---------- 아이템 편집 ----------
const editing = ref(null);   // { id?, name, description, smallImage, largeImage, effect, effectValuesText, isBound, isSellable }
const saving = ref(false);
const editError = ref('');

function newItem() {
  editError.value = '';
  editing.value = {
    name: '', description: '', smallImage: '', largeImage: '',
    effect: 'none', effectValuesText: '{}', isBound: false, isSellable: true,
  };
}

function editItem(item) {
  editError.value = '';
  editing.value = {
    id: item.id,
    name: item.name,
    description: item.description,
    smallImage: item.smallImage || '',
    largeImage: item.largeImage || '',
    effect: item.effect,
    effectValuesText: JSON.stringify(item.effectValues, null, 2),
    isBound: item.isBound,
    isSellable: item.isSellable,
  };
}

const currentEffect = computed(() => itemEffects.list.find((e) => e.code === editing.value?.effect));
function useExample() {
  editing.value.effectValuesText = JSON.stringify(JSON.parse(currentEffect.value?.example || '{}'), null, 2);
}

async function saveItem() {
  editError.value = '';
  saving.value = true;
  const { id, effectValuesText, ...rest } = editing.value;
  try {
    const body = { ...rest, effectValues: effectValuesText };
    if (id) await api(`/admin/items/${id}`, { method: 'PUT', body });
    else await api('/admin/items', { method: 'POST', body });
    flash(`'${rest.name}' ${id ? '수정' : '등록'}했습니다.`);
    editing.value = null;
    await loadItems();
  } catch (e) {
    editError.value = e.message;
  } finally {
    saving.value = false;
  }
}

async function removeItem(item) {
  const extra = item.ownerCount ? `\n캐릭터 ${item.ownerCount}명의 인벤토리에서도 사라집니다.` : '';
  if (!confirm(`'${item.name}' 아이템을 삭제할까요?${extra}\n되돌릴 수 없습니다.`)) return;
  try {
    await api(`/admin/items/${item.id}`, { method: 'DELETE' });
    flash(`'${item.name}' 삭제했습니다.`);
    await loadItems();
  } catch (e) {
    error.value = e.message;
  }
}

// ---------- 일괄 처리 (체크한 아이템 — 지금 보이는 목록 기준) ----------
const sel = useSelection(() => shown.value);

async function bulk(fn, text) {
  error.value = '';
  try {
    await fn();
    sel.clear();
    flash(text);
    await loadItems();
  } catch (e) {
    error.value = e.message;
  }
}

const bulkFlag = (patch, text) => {
  const ids = sel.ids.value;
  return bulk(() => api('/admin/items/bulk', { method: 'PATCH', body: { ids, ...patch } }), `${ids.length}개 아이템: ${text}`);
};

function bulkRemove() {
  const chosen = items.value.filter((i) => sel.has(i.id));
  const owners = chosen.reduce((n, i) => n + i.ownerCount, 0);
  if (!confirm(`${chosen.length}개 아이템을 삭제할까요?\n${chosen.map((i) => i.name).join(', ')}${owners ? `\n\n보유 중인 인벤토리(${owners}건)와 상점에서도 사라집니다.` : ''}\n되돌릴 수 없습니다.`)) return;
  return bulk(() => api('/admin/items/bulk-delete', { method: 'POST', body: { ids: chosen.map((i) => i.id) } }), `${chosen.length}개 아이템을 삭제했습니다.`);
}

onMounted(() => Promise.all([loadItems(), loadItemEffects({ force: true })]).catch((e) => { error.value = e.message; }));
</script>

<template>
  <section class="card">
    <div class="card-head">
      <h1>아이템 목록</h1>
      <button type="button" @click="newItem">새 아이템</button>
    </div>
    <p v-if="error" class="error">{{ error }}</p>
    <p v-if="message" class="ok">{{ message }}</p>

    <!-- 검색 · 정렬 · 효과별 -->
    <div class="filter-bar">
      <input v-model="query" type="search" placeholder="아이템 검색 (이름 · 설명 · uid)" aria-label="아이템 검색" />
      <select v-model="sort" aria-label="정렬">
        <option v-for="s in SORTS" :key="s.value" :value="s.value">{{ s.label }}</option>
      </select>
      <select v-model="effectFilter" aria-label="효과별 보기">
        <option value="">효과: 전체</option>
        <option v-for="e in itemEffects.list" :key="e.code" :value="e.code">효과: {{ e.label }}</option>
      </select>
      <button v-if="filtered || sort !== 'new'" type="button" class="secondary small" @click="resetFilters">초기화</button>
      <span class="muted">{{ filtered ? `${shown.length} / ${items.length}개` : `${items.length}개` }}</span>
    </div>

    <p v-if="!items.length" class="muted">등록된 아이템이 없습니다.</p>
    <p v-else-if="!shown.length" class="muted">조건에 맞는 아이템이 없습니다.</p>
    <BulkBar v-if="shown.length" :count="sel.ids.value.length" @clear="sel.clear()">
      <button type="button" class="secondary" :disabled="!sel.ids.value.length" @click="bulkFlag({ isBound: true }, '귀속으로')">귀속으로</button>
      <button type="button" class="secondary" :disabled="!sel.ids.value.length" @click="bulkFlag({ isBound: false }, '귀속 해제')">귀속 해제</button>
      <button type="button" class="secondary" :disabled="!sel.ids.value.length" @click="bulkFlag({ isSellable: true }, '판매 가능')">판매 가능</button>
      <button type="button" class="secondary" :disabled="!sel.ids.value.length" @click="bulkFlag({ isSellable: false }, '판매 불가')">판매 불가</button>
      <button type="button" class="danger" :disabled="!sel.ids.value.length" @click="bulkRemove">선택 삭제</button>
    </BulkBar>
    <div v-if="shown.length" class="table-wrap">
      <table class="table">
        <thead>
          <tr>
            <th class="check"><input type="checkbox" aria-label="전체 선택" :checked="sel.allChecked.value" :indeterminate="sel.someChecked.value" @change="sel.toggleAll()" /></th>
            <th>uid</th><th></th><th>이름</th><th>효과</th><th>귀속</th><th>판매</th><th>보유</th><th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in shown" :key="item.id" :class="{ checked: sel.has(item.id) }">
            <td class="check"><input type="checkbox" :aria-label="`${item.name} 선택`" :checked="sel.has(item.id)" @change="sel.toggle(item.id)" /></td>
            <td>{{ item.id }}</td>
            <td><img v-if="item.smallImage" :src="item.smallImage" :alt="item.name" class="item-icon" /></td>
            <td class="title-cell">{{ item.name }}</td>
            <td class="title-cell">{{ effectLabel(item.effect) }} <span class="muted">{{ formatEffectValues(item.effectValues) }}</span></td>
            <td>{{ item.isBound ? '귀속' : '-' }}</td>
            <td>{{ item.isSellable ? '가능' : '불가' }}</td>
            <td>
              <RouterLink v-if="item.ownerCount" :to="{ path: '/admin/items/characters', query: { itemId: item.id } }" title="이 아이템을 가진 캐릭터 보기">{{ item.ownerCount }}명</RouterLink>
              <span v-else class="muted">0명</span>
            </td>
            <td class="row-actions">
              <button type="button" class="secondary" @click="editItem(item)">수정</button>
              <button type="button" class="danger" @click="removeItem(item)">삭제</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>

  <ModalDialog v-if="editing" :title="editing.id ? `아이템 수정 (uid ${editing.id})` : '새 아이템'" @close="editing = null">
    <template #actions>
      <button type="submit" form="item-form" :disabled="saving">{{ saving ? '저장 중…' : '저장' }}</button>
      <button type="button" class="secondary" @click="editing = null">취소</button>
    </template>
    <form id="item-form" class="form" @submit.prevent="saveItem">
      <fieldset class="fieldset">
        <legend>기본 정보</legend>
        <div class="field">
          <label for="item-name">이름<span class="req">*</span></label>
          <input id="item-name" v-model="editing.name" required maxlength="100" />
        </div>
        <div class="field">
          <label for="item-desc">설명</label>
          <MarkdownEditor id="item-desc" v-model="editing.description" :rows="5" :maxlength="10000" />
        </div>
      </fieldset>
      <fieldset class="fieldset">
        <legend>이미지</legend>
        <div class="field"><label for="item-small">작은 이미지 (인벤토리 칸)</label><ImageField id="item-small" v-model="editing.smallImage" /></div>
        <div class="field"><label for="item-large">큰 이미지 (상세 보기)</label><ImageField id="item-large" v-model="editing.largeImage" /></div>
      </fieldset>
      <fieldset class="fieldset">
        <legend>효과</legend>
        <div class="field">
          <label for="item-effect">효과 종류 <RouterLink to="/admin/items/effects" class="small-link">효과 관리</RouterLink></label>
          <select id="item-effect" v-model="editing.effect">
            <option v-for="e in itemEffects.list" :key="e.code" :value="e.code">{{ e.label }} ({{ e.code }})</option>
          </select>
          <span v-if="currentEffect?.description" class="muted">{{ currentEffect.description }}</span>
        </div>
        <div class="field">
          <label for="item-values">효과수치 (JSON) <button type="button" class="link small-link" @click="useExample">예시 넣기</button></label>
          <textarea id="item-values" v-model="editing.effectValuesText" rows="3" class="mono" />
        </div>
      </fieldset>
      <fieldset class="fieldset">
        <legend>설정</legend>
        <label class="toggle"><ToggleSwitch v-model="editing.isBound" /> 귀속 (다른 캐릭터에게 넘길 수 없음)</label>
        <label class="toggle"><ToggleSwitch v-model="editing.isSellable" /> 판매 가능</label>
      </fieldset>
      <p v-if="editError" class="error">{{ editError }}</p>
    </form>
  </ModalDialog>
</template>
