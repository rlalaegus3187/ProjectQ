<script setup>
// 관리자: 아이템 등록/수정/삭제 + 캐릭터 인벤토리 지급/회수
import { ref, onMounted } from 'vue';
import { api } from '../../api';
import { EFFECTS, effectLabel, formatEffectValues, itemSourceLabel } from '../../items';
import { MarkdownEditor } from '../../markdown';
import ImageField from '../../components/ImageField.vue';
import ModalDialog from '../../components/ModalDialog.vue';
import MoneyLogList from '../../components/MoneyLogList.vue';
import ItemLogList from '../../components/ItemLogList.vue';
import BulkBar from '../../components/BulkBar.vue';
import { useSelection } from '../../selection';
import { formatMoney } from '../../items';

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

function useExample() {
  editing.value.effectValuesText = EFFECTS.find((e) => e.value === editing.value.effect)?.example ?? '{}';
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
    if (target.value) await loadTargetInventory();
  } catch (e) {
    error.value = e.message;
  }
}

// ---------- 일괄 처리 (체크한 아이템) ----------
const sel = useSelection(() => items.value);

async function bulk(fn, text) {
  error.value = '';
  try {
    await fn();
    sel.clear();
    flash(text);
    await loadItems();
    if (target.value) await loadTargetInventory();
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

// ---------- 지급 / 회수 ----------
const query = ref('');
const results = ref([]);
const target = ref(null);          // 선택한 캐릭터
const targetInventory = ref([]);
const targetMoney = ref(0);
const targetMoneyLogs = ref([]);
const targetItemLogs = ref([]);
const moneyForm = ref({ amount: '', memo: '' });
const give = ref({ itemId: '', quantity: 1, memo: '' });
const giveError = ref('');

async function search() {
  results.value = (await api(`/admin/characters?q=${encodeURIComponent(query.value)}`)).characters;
}

async function selectTarget(c) {
  target.value = c;
  giveError.value = '';
  await loadTargetInventory();
}

async function loadTargetInventory() {
  const data = await api(`/admin/characters/${target.value.id}/inventory`);
  targetInventory.value = data.inventory;
  targetMoney.value = data.money;
  targetMoneyLogs.value = data.moneyLogs;
  targetItemLogs.value = data.itemLogs;
}

async function giveItem() {
  giveError.value = '';
  try {
    await api(`/admin/characters/${target.value.id}/inventory`, { method: 'POST', body: give.value });
    const item = items.value.find((i) => i.id === give.value.itemId);
    flash(`${target.value.name}에게 '${item?.name}' ${give.value.quantity}개를 지급했습니다. (알림 발송)`);
    give.value = { itemId: give.value.itemId, quantity: 1, memo: give.value.memo };
    await Promise.all([loadTargetInventory(), loadItems()]);
  } catch (e) {
    giveError.value = e.message;
  }
}

// 소지금 지급(+) / 회수(-)
async function changeMoney(sign) {
  giveError.value = '';
  const amount = Math.abs(Number(moneyForm.value.amount)) * sign;
  try {
    const { money } = await api(`/admin/characters/${target.value.id}/money`, { method: 'POST', body: { amount, memo: moneyForm.value.memo } });
    flash(`${target.value.name} 소지금 ${amount > 0 ? '+' : ''}${formatMoney(amount)} → ${formatMoney(money)} (알림 발송)`);
    moneyForm.value = { amount: '', memo: '' };
    await loadTargetInventory();
  } catch (e) {
    giveError.value = e.message;
  }
}

async function takeBack(entry) {
  const input = prompt(`'${entry.item.name}' 몇 개를 회수할까요? (보유 ${entry.quantity}개)`, String(entry.quantity));
  if (input === null) return;
  const memo = prompt('회수 사유 (선택, 기록에 남음)', '') ?? '';
  try {
    await api(`/admin/characters/${target.value.id}/inventory/${entry.item.id}?quantity=${encodeURIComponent(input)}&memo=${encodeURIComponent(memo)}`, { method: 'DELETE' });
    flash(`'${entry.item.name}' ${input}개를 회수했습니다.`);
    await Promise.all([loadTargetInventory(), loadItems()]);
  } catch (e) {
    giveError.value = e.message;
  }
}

onMounted(() => Promise.all([loadItems(), search()]).catch((e) => { error.value = e.message; }));
</script>

<template>
  <section class="card">
    <div class="card-head">
      <h1>아이템 관리</h1>
      <button type="button" @click="newItem">새 아이템</button>
    </div>
    <p v-if="error" class="error">{{ error }}</p>
    <p v-if="message" class="ok">{{ message }}</p>

    <p v-if="!items.length" class="muted">등록된 아이템이 없습니다.</p>
    <BulkBar v-if="items.length" :count="sel.ids.value.length" @clear="sel.clear()">
      <button type="button" class="secondary" :disabled="!sel.ids.value.length" @click="bulkFlag({ isBound: true }, '귀속으로')">귀속으로</button>
      <button type="button" class="secondary" :disabled="!sel.ids.value.length" @click="bulkFlag({ isBound: false }, '귀속 해제')">귀속 해제</button>
      <button type="button" class="secondary" :disabled="!sel.ids.value.length" @click="bulkFlag({ isSellable: true }, '판매 가능')">판매 가능</button>
      <button type="button" class="secondary" :disabled="!sel.ids.value.length" @click="bulkFlag({ isSellable: false }, '판매 불가')">판매 불가</button>
      <button type="button" class="danger" :disabled="!sel.ids.value.length" @click="bulkRemove">선택 삭제</button>
    </BulkBar>
    <div v-if="items.length" class="table-wrap">
      <table class="table">
        <thead>
          <tr>
            <th class="check"><input type="checkbox" aria-label="전체 선택" :checked="sel.allChecked.value" :indeterminate="sel.someChecked.value" @change="sel.toggleAll()" /></th>
            <th>uid</th><th></th><th>이름</th><th>효과</th><th>귀속</th><th>판매</th><th>보유</th><th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in items" :key="item.id" :class="{ checked: sel.has(item.id) }">
            <td class="check"><input type="checkbox" :aria-label="`${item.name} 선택`" :checked="sel.has(item.id)" @change="sel.toggle(item.id)" /></td>
            <td>{{ item.id }}</td>
            <td><img v-if="item.smallImage" :src="item.smallImage" :alt="item.name" class="item-icon" /></td>
            <td class="title-cell">{{ item.name }}</td>
            <td class="title-cell">{{ effectLabel(item.effect) }} <span class="muted">{{ formatEffectValues(item.effectValues) }}</span></td>
            <td>{{ item.isBound ? '귀속' : '-' }}</td>
            <td>{{ item.isSellable ? '가능' : '불가' }}</td>
            <td>{{ item.ownerCount }}명</td>
            <td class="row-actions">
              <button type="button" class="secondary" @click="editItem(item)">수정</button>
              <button type="button" class="danger" @click="removeItem(item)">삭제</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>

  <section class="card">
    <h2>캐릭터 인벤토리 (지급 / 회수)</h2>
    <form class="add-row" @submit.prevent="search">
      <input v-model="query" placeholder="캐릭터 이름, 아이디, 소통 계정으로 검색" />
      <button type="submit" class="secondary">검색</button>
    </form>
    <ul class="post-list char-results">
      <li v-for="c in results" :key="c.id">
        <button type="button" class="post-link" :class="{ selected: target?.id === c.id }" @click="selectTarget(c)">
          <span class="post-title"><strong>{{ c.name }}</strong></span>
          <span class="post-meta">{{ c.username }}<template v-if="c.contact"> · {{ c.contact }}</template></span>
        </button>
      </li>
    </ul>

    <div v-if="target" class="target-panel">
      <h3>{{ target.name }} <span class="money-badge">소지금 <strong>{{ formatMoney(targetMoney) }}</strong></span></h3>
      <form class="add-row" @submit.prevent>
        <input v-model.number="moneyForm.amount" class="money-input" type="number" min="1" step="1" placeholder="금액" required />
        <input v-model="moneyForm.memo" maxlength="100" placeholder="메모 (예: 이벤트 보상)" />
        <button type="button" :disabled="!moneyForm.amount" @click="changeMoney(1)">지급</button>
        <button type="button" class="danger" :disabled="!moneyForm.amount" @click="changeMoney(-1)">회수</button>
      </form>
      <details class="money-details">
        <summary>최근 소지금 내역</summary>
        <MoneyLogList :logs="targetMoneyLogs" />
      </details>
      <h3>인벤토리</h3>
      <form class="add-row" @submit.prevent="giveItem">
        <select v-model="give.itemId" required>
          <option value="" disabled>지급할 아이템 선택</option>
          <option v-for="item in items" :key="item.id" :value="item.id">[{{ item.id }}] {{ item.name }}</option>
        </select>
        <input v-model.number="give.quantity" class="narrow" type="number" min="1" max="99999" step="1" required title="수량" />
        <input v-model="give.memo" maxlength="100" placeholder="획득처 (예: 1차 이벤트 보상)" title="어디서 얻었는지 — 기록과 알림에 표시" />
        <button type="submit">지급</button>
      </form>
      <p v-if="giveError" class="error">{{ giveError }}</p>
      <p v-if="!targetInventory.length" class="muted">아이템이 없습니다.</p>
      <ul v-else class="post-list">
        <li v-for="entry in targetInventory" :key="entry.item.id" class="inv-row">
          <img v-if="entry.item.smallImage" :src="entry.item.smallImage" :alt="entry.item.name" class="item-icon" />
          <span class="post-title">{{ entry.item.name }} <span class="muted">x {{ entry.quantity }}</span>
            <span class="muted inv-acquired">최근 습득 {{ new Date(entry.lastAcquiredAt).toLocaleString('ko-KR') }} · {{ itemSourceLabel(entry.lastSource) }}<template v-if="entry.lastMemo"> ({{ entry.lastMemo }})</template></span>
          </span>
          <button type="button" class="danger small" @click="takeBack(entry)">회수</button>
        </li>
      </ul>
      <details class="money-details" open>
        <summary>아이템 습득 · 사용 기록 (최근 30개)</summary>
        <ItemLogList :logs="targetItemLogs" show-actor />
      </details>
    </div>
  </section>

  <ModalDialog v-if="editing" :title="editing.id ? `아이템 수정 (uid ${editing.id})` : '새 아이템'" @close="editing = null">
    <!-- 프로필 수정과 같은 폼 모양: 칸 묶음(fieldset) + 한 줄에 한 칸 + 아래 버튼 -->
    <form class="form" @submit.prevent="saveItem">
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
          <label for="item-effect">효과 종류</label>
          <select id="item-effect" v-model="editing.effect">
            <option v-for="e in EFFECTS" :key="e.value" :value="e.value">{{ e.label }} ({{ e.value }})</option>
          </select>
        </div>
        <div class="field">
          <label for="item-values">효과수치 (JSON) <button type="button" class="link small-link" @click="useExample">예시 넣기</button></label>
          <textarea id="item-values" v-model="editing.effectValuesText" rows="3" class="mono" />
        </div>
      </fieldset>
      <fieldset class="fieldset">
        <legend>설정</legend>
        <label class="inline"><input v-model="editing.isBound" type="checkbox" /> 귀속 (다른 캐릭터에게 넘길 수 없음)</label>
        <label class="inline"><input v-model="editing.isSellable" type="checkbox" /> 판매 가능</label>
      </fieldset>
      <p v-if="editError" class="error">{{ editError }}</p>
      <div class="actions">
        <button type="submit" :disabled="saving">{{ saving ? '저장 중…' : '저장' }}</button>
        <button type="button" class="secondary" @click="editing = null">취소</button>
      </div>
    </form>
  </ModalDialog>
</template>
