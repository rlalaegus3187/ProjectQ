<script setup>
import { ref, reactive, onMounted } from 'vue';
import { api } from '../../api';
import { setSite } from '../../site';
import { VALUE_TYPES } from '../../character';
import { useSelection } from '../../selection';
import BulkBar from '../../components/BulkBar.vue';

const CATEGORIES = [
  { key: 'stats', category: 'stat', title: '캐릭터 스탯', defaultType: 'number' },
  { key: 'details', category: 'detail', title: '프로필 양식', defaultType: 'text' },
];

const lists = ref({ stats: [], details: [] });
const statPoints = ref(0);        // 저장된 초기 투자 포인트
const statPointsDraft = ref(0);   // 입력 중인 값
const statsEnabled = ref(true);   // 캐릭터 스탯 사용 여부 (끄면 회원가입·마이페이지·캐릭터 화면에서 스탯이 숨겨짐)
const drafts = reactive({});   // id → 수정 중인 값
const error = ref('');
const message = ref('');

function emptyNew(type) {
  return { code: '', label: '', valueType: type, optionsText: '', isRequired: false, sortOrder: 0 };
}
const newItem = reactive({ stats: emptyNew('number'), details: emptyNew('text') });

function toDraft(item) {
  return {
    label: item.label,
    valueType: item.valueType,
    optionsText: (item.options || []).join('\n'),
    isRequired: item.isRequired,
    sortOrder: item.sortOrder,
    isActive: item.isActive,
  };
}

function isDirty(item) {
  const d = drafts[item.id];
  return d && JSON.stringify(d) !== JSON.stringify(toDraft(item));
}

async function load() {
  const [attrs, settings] = await Promise.all([api('/admin/attributes'), api('/admin/settings')]);
  lists.value = attrs;
  statPoints.value = settings.statPoints;
  statPointsDraft.value = settings.statPoints;
  statsEnabled.value = settings.statsEnabled !== false;
  for (const item of [...lists.value.stats, ...lists.value.details]) drafts[item.id] = toDraft(item);
}

function flash(text) {
  message.value = text;
  setTimeout(() => { if (message.value === text) message.value = ''; }, 2500);
}

// fn 이 문자열을 반환하면 그 문구를, 아니면 doneText 를 표시
async function run(fn, doneText) {
  error.value = '';
  try {
    const text = await fn();
    await load();
    flash(typeof text === 'string' ? text : doneText);
  } catch (e) {
    error.value = e.message;
  }
}

function add(c) {
  const item = newItem[c.key];
  return run(async () => {
    await api('/admin/attributes', {
      method: 'POST',
      body: {
        category: c.category,
        code: item.code,
        label: item.label,
        valueType: item.valueType,
        options: item.optionsText,
        isRequired: item.isRequired,
        sortOrder: item.sortOrder,
      },
    });
    Object.assign(item, emptyNew(c.defaultType));
  }, `'${item.label}' 추가했습니다.`);
}

function save(item) {
  const d = drafts[item.id];
  if (d.valueType !== item.valueType
      && !confirm(`형식을 바꾸면 이미 입력된 값이 새 형식에 맞지 않을 수 있습니다.\n(맞지 않는 값은 다음에 캐릭터를 수정할 때 다시 입력해야 합니다)\n\n변경할까요?`)) {
    return;
  }
  const body = {
    label: d.label,
    isRequired: d.isRequired,
    sortOrder: Number(d.sortOrder),
    isActive: d.isActive,
    valueType: d.valueType,
  };
  if (d.valueType === 'select') body.options = d.optionsText;
  return run(() => api(`/admin/attributes/${item.id}`, { method: 'PATCH', body }), `'${d.label}' 저장했습니다.`);
}

// ---------- 일괄 처리 (체크한 항목) ----------
const sels = {
  stats: useSelection(() => lists.value.stats),
  details: useSelection(() => lists.value.details),
};
const selectedItems = (c) => lists.value[c.key].filter((item) => sels[c.key].has(item.id));

// 체크한 항목의 입력칸(이름·형식·필수·순서·사용) 내용을 한꺼번에 저장
function bulkSave(c) {
  const items = selectedItems(c);
  const typeChanged = items.filter((item) => drafts[item.id].valueType !== item.valueType);
  if (typeChanged.length && !confirm(`${typeChanged.map((i) => `'${i.label}'`).join(', ')} 의 형식이 바뀝니다.\n이미 입력된 값이 새 형식에 맞지 않을 수 있습니다. 저장할까요?`)) return;
  const body = items.map((item) => {
    const d = drafts[item.id];
    const row = { id: item.id, label: d.label, valueType: d.valueType, isRequired: d.isRequired, sortOrder: Number(d.sortOrder), isActive: d.isActive };
    if (d.valueType === 'select') row.options = d.optionsText;
    return row;
  });
  return run(async () => {
    await api('/admin/attributes/bulk', { method: 'PUT', body: { items: body } });
    sels[c.key].clear();
  }, `${items.length}개 항목을 저장했습니다.`);
}

// 사용/필수 켜기·끄기
function bulkFlag(c, patch, text) {
  const ids = sels[c.key].ids.value;
  return run(() => api('/admin/attributes/bulk', { method: 'PATCH', body: { ids, ...patch } }), `${ids.length}개 항목: ${text}`);
}

function bulkRemove(c) {
  const items = selectedItems(c);
  if (!confirm(`${items.length}개 항목을 삭제할까요?\n${items.map((i) => i.label).join(', ')}\n\n모든 캐릭터에 입력된 값도 함께 삭제되며 되돌릴 수 없습니다. (값을 남기려면 '사용 끄기')`)) return;
  return run(async () => {
    const { deleted, deletedValues } = await api('/admin/attributes/bulk-delete', { method: 'POST', body: { ids: items.map((i) => i.id) } });
    for (const item of items) delete drafts[item.id];
    sels[c.key].clear();
    return `${deleted}개 항목을 삭제했습니다. (저장된 값 ${deletedValues}개 함께 삭제)`;
  });
}

// 캐릭터 스탯 사용 / 미사용 — 스위치를 누르면 바로 저장
function toggleStats() {
  const on = statsEnabled.value;
  return run(async () => {
    setSite(await api('/admin/settings', { method: 'PUT', body: { statsEnabled: on } }));
    return on ? '캐릭터 스탯을 사용합니다.' : '캐릭터 스탯을 사용하지 않습니다. (저장된 값은 남아 있음)';
  });
}

function saveStatPoints() {
  return run(
    () => api('/admin/settings', { method: 'PUT', body: { statPoints: statPointsDraft.value } }),
    `초기 투자 포인트를 ${statPointsDraft.value}(으)로 저장했습니다.`,
  );
}

function remove(item) {
  if (!confirm(`'${item.label}' 항목을 삭제할까요?\n모든 캐릭터에 입력된 이 항목의 값도 함께 삭제되며 되돌릴 수 없습니다.\n(값을 남겨두려면 삭제 대신 '사용'을 끄세요)`)) return;
  return run(async () => {
    const { deletedValues } = await api(`/admin/attributes/${item.id}`, { method: 'DELETE' });
    delete drafts[item.id];
    return `'${item.label}' 삭제했습니다. (저장된 값 ${deletedValues}개 함께 삭제)`;
  });
}

onMounted(() => load().catch((e) => { error.value = e.message; }));
</script>

<template>
  <section class="card">
    <h1>캐릭터 항목 관리</h1>
    <p class="muted">
      캐릭터 스탯과 프로필 양식으로 어떤 값을 받을지 정합니다. 여기서 추가한 항목이 회원가입·마이페이지 입력칸에 바로 나타납니다.
      '사용'을 끄면 입력/표시에서 숨겨지고 저장된 값은 남아 있으며, '삭제'하면 저장된 값까지 모두 지워집니다.
    </p>
    <p v-if="error" class="error">{{ error }}</p>
    <p v-if="message" class="ok">{{ message }}</p>
  </section>

  <section v-for="c in CATEGORIES" :key="c.key" class="card">
    <h2>{{ c.title }}</h2>
    <div v-if="c.category === 'stat'" class="form">
      <label class="switch-row">
        <span class="switch">
          <input v-model="statsEnabled" type="checkbox" role="switch" :aria-checked="statsEnabled" @change="toggleStats" />
          <span class="slider" />
        </span>
        <span>
          캐릭터 스탯 <strong :class="statsEnabled ? 'on' : 'off'">{{ statsEnabled ? '사용' : '미사용' }}</strong>
          <span class="muted">— 미사용이면 회원가입·마이페이지·캐릭터 화면에서 캐릭터 스탯이 아예 보이지 않고 입력도 받지 않습니다. 이미 저장된 값은 남아 있어 다시 켜면 그대로 보입니다.</span>
        </span>
      </label>
    </div>
    <form v-if="c.category === 'stat'" class="points-setting" @submit.prevent="saveStatPoints">
      <label>
        초기 투자 포인트
        <input v-model.number="statPointsDraft" class="narrow" type="number" min="0" max="1000000" step="1" required />
      </label>
      <button type="submit" :disabled="statPointsDraft === statPoints">저장</button>
      <p class="muted">
        캐릭터마다 이 포인트를 <strong>숫자</strong> 형식의 스탯에 나눠 투자합니다. 투자한 합계는 이 값을 넘을 수 없습니다.
        (값을 줄이면, 이미 더 많이 투자한 캐릭터는 다음에 수정할 때 줄여야 저장됩니다)
      </p>
    </form>

    <BulkBar v-if="lists[c.key].length" :count="sels[c.key].ids.value.length" @clear="sels[c.key].clear()">
      <button type="button" :disabled="!sels[c.key].ids.value.length" @click="bulkSave(c)">선택 저장</button>
      <button type="button" class="secondary" :disabled="!sels[c.key].ids.value.length" @click="bulkFlag(c, { isActive: true }, '사용 켬')">사용 켜기</button>
      <button type="button" class="secondary" :disabled="!sels[c.key].ids.value.length" @click="bulkFlag(c, { isActive: false }, '사용 끔')">사용 끄기</button>
      <button type="button" class="secondary" :disabled="!sels[c.key].ids.value.length" @click="bulkFlag(c, { isRequired: true }, '필수로')">필수로</button>
      <button type="button" class="secondary" :disabled="!sels[c.key].ids.value.length" @click="bulkFlag(c, { isRequired: false }, '선택으로')">선택으로</button>
      <button type="button" class="danger" :disabled="!sels[c.key].ids.value.length" @click="bulkRemove(c)">선택 삭제</button>
    </BulkBar>

    <div class="table-wrap">
      <table class="table">
        <thead>
          <tr>
            <th class="check">
              <input type="checkbox" aria-label="전체 선택" :checked="sels[c.key].allChecked.value"
                :indeterminate="sels[c.key].someChecked.value" :disabled="!lists[c.key].length" @change="sels[c.key].toggleAll()" />
            </th>
            <th>코드</th><th>표시 이름</th><th>형식</th><th>필수</th><th>순서</th><th>사용</th><th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="!lists[c.key].length"><td colspan="8" class="muted">항목이 없습니다.</td></tr>
          <template v-for="item in lists[c.key]" :key="item.id">
            <tr v-if="drafts[item.id]" :class="{ inactive: !drafts[item.id].isActive, dirty: isDirty(item), checked: sels[c.key].has(item.id) }">
              <td class="check"><input type="checkbox" :aria-label="`${item.label} 선택`" :checked="sels[c.key].has(item.id)" @change="sels[c.key].toggle(item.id)" /></td>
              <td><code>{{ item.code }}</code></td>
              <td><input v-model="drafts[item.id].label" maxlength="100" /></td>
              <td>
                <select v-model="drafts[item.id].valueType">
                  <option v-for="t in VALUE_TYPES" :key="t.value" :value="t.value">{{ t.label }}</option>
                </select>
              </td>
              <td><input v-model="drafts[item.id].isRequired" type="checkbox" /></td>
              <td><input v-model.number="drafts[item.id].sortOrder" class="narrow" type="number" step="1" /></td>
              <td><input v-model="drafts[item.id].isActive" type="checkbox" /></td>
              <td class="row-actions">
                <button type="button" :disabled="!isDirty(item)" @click="save(item)">저장</button>
                <button type="button" class="danger" @click="remove(item)">삭제</button>
              </td>
            </tr>
            <tr v-if="drafts[item.id]?.valueType === 'select'" class="options-row">
              <td></td><td></td>
              <td colspan="6">
                <label class="options-label">
                  드롭다운 선택지 (한 줄에 하나씩)
                  <textarea v-model="drafts[item.id].optionsText" rows="3" placeholder="예)&#10;전사&#10;마법사&#10;궁수" />
                </label>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>

    <form class="add-form" @submit.prevent="add(c)">
      <h3>새 항목 추가</h3>
      <div class="add-row">
        <input v-model="newItem[c.key].code" placeholder="코드 (예: str, class)" required pattern="[a-z][a-z0-9_]{0,49}" title="영문 소문자로 시작, 영문 소문자/숫자/_" />
        <input v-model="newItem[c.key].label" placeholder="표시 이름 (예: 힘, 직업)" required maxlength="100" />
        <select v-model="newItem[c.key].valueType" title="형식">
          <option v-for="t in VALUE_TYPES" :key="t.value" :value="t.value">{{ t.label }}</option>
        </select>
        <input v-model.number="newItem[c.key].sortOrder" class="narrow" type="number" step="1" title="정렬 순서" />
        <label class="inline"><input v-model="newItem[c.key].isRequired" type="checkbox" /> 필수</label>
        <button type="submit">추가</button>
      </div>
      <label v-if="newItem[c.key].valueType === 'select'" class="options-label">
        드롭다운 선택지 (한 줄에 하나씩)
        <textarea v-model="newItem[c.key].optionsText" rows="3" required placeholder="예)&#10;전사&#10;마법사&#10;궁수" />
      </label>
    </form>
  </section>
</template>
