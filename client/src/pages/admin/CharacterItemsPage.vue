<script setup>
// 관리자: 아이템 관리 → 캐릭터 아이템 관리
//   캐릭터 목록(보유 아이템 종류·개수·소지금) — 검색, '이 아이템을 가진 캐릭터만' (주소 ?itemId=)
//   캐릭터를 고르면 오른쪽(아래)에 인벤토리: 아이템 지급 / 회수, 소지금 지급 / 회수, 기록
import { ref, computed, watch, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api } from '../../api';
import { itemSourceLabel, formatMoney } from '../../items';
import MoneyLogList from '../../components/MoneyLogList.vue';
import ItemLogList from '../../components/ItemLogList.vue';

const route = useRoute();
const router = useRouter();
const items = ref([]);          // 전체 아이템 (지급할 아이템 고르기, 보유 아이템 필터)
const characters = ref([]);
const query = ref('');
const error = ref('');
const message = ref('');

function flash(text) {
  message.value = text;
  setTimeout(() => { if (message.value === text) message.value = ''; }, 3000);
}

// '이 아이템을 가진 캐릭터만' — 주소 ?itemId= 와 연결
const ownerFilter = computed({
  get: () => (route.query.itemId ? Number(route.query.itemId) : ''),
  set: (id) => router.replace({ query: { ...route.query, itemId: id || undefined } }),
});
const ownerItem = computed(() => items.value.find((i) => i.id === ownerFilter.value));
const itemsByName = computed(() => [...items.value].sort((a, b) => a.name.localeCompare(b.name, 'ko')));

async function loadCharacters() {
  const params = new URLSearchParams({ q: query.value });
  if (ownerFilter.value) params.set('itemId', ownerFilter.value);
  characters.value = (await api(`/admin/characters?${params}`)).characters;
}

// ---------- 선택한 캐릭터 ----------
const target = ref(null);
const inventory = ref([]);
const money = ref(0);
const moneyLogs = ref([]);
const itemLogs = ref([]);
const moneyForm = ref({ amount: '', memo: '' });
const give = ref({ itemId: '', quantity: 1, memo: '' });
const giveQuery = ref('');      // 지급할 아이템 검색
const panelError = ref('');

const giveChoices = computed(() => {
  const q = giveQuery.value.trim().toLowerCase();
  return itemsByName.value.filter((i) => !q || i.name.toLowerCase().includes(q));
});
// 검색 결과가 하나면 바로 선택
watch(giveChoices, (list) => { if (list.length === 1) give.value.itemId = list[0].id; });

async function selectTarget(c) {
  target.value = c;
  panelError.value = '';
  await loadInventory();
}

async function loadInventory() {
  const data = await api(`/admin/characters/${target.value.id}/inventory`);
  inventory.value = data.inventory;
  money.value = data.money;
  moneyLogs.value = data.moneyLogs;
  itemLogs.value = data.itemLogs;
}

// 지급·회수 뒤: 인벤토리 + 목록의 보유 개수 새로고침
async function refresh() {
  await Promise.all([loadInventory(), loadCharacters()]);
}

async function giveItem() {
  panelError.value = '';
  try {
    await api(`/admin/characters/${target.value.id}/inventory`, { method: 'POST', body: give.value });
    const item = items.value.find((i) => i.id === give.value.itemId);
    flash(`${target.value.name}에게 '${item?.name}' ${give.value.quantity}개를 지급했습니다. (알림 발송)`);
    give.value = { itemId: give.value.itemId, quantity: 1, memo: give.value.memo };
    await refresh();
  } catch (e) {
    panelError.value = e.message;
  }
}

async function takeBack(entry) {
  const input = prompt(`'${entry.item.name}' 몇 개를 회수할까요? (보유 ${entry.quantity}개)`, String(entry.quantity));
  if (input === null) return;
  const memo = prompt('회수 사유 (선택, 기록에 남음)', '') ?? '';
  panelError.value = '';
  try {
    await api(`/admin/characters/${target.value.id}/inventory/${entry.item.id}?quantity=${encodeURIComponent(input)}&memo=${encodeURIComponent(memo)}`, { method: 'DELETE' });
    flash(`'${entry.item.name}' ${input}개를 회수했습니다.`);
    await refresh();
  } catch (e) {
    panelError.value = e.message;
  }
}

// 소지금 지급(+) / 회수(-)
async function changeMoney(sign) {
  panelError.value = '';
  const amount = Math.abs(Number(moneyForm.value.amount)) * sign;
  try {
    const res = await api(`/admin/characters/${target.value.id}/money`, { method: 'POST', body: { amount, memo: moneyForm.value.memo } });
    flash(`${target.value.name} 소지금 ${amount > 0 ? '+' : ''}${formatMoney(amount)} → ${formatMoney(res.money)} (알림 발송)`);
    moneyForm.value = { amount: '', memo: '' };
    await refresh();
  } catch (e) {
    panelError.value = e.message;
  }
}

watch(() => route.query.itemId, () => loadCharacters().catch((e) => { error.value = e.message; }));
onMounted(async () => {
  try {
    items.value = (await api('/admin/items')).items;
    await loadCharacters();
  } catch (e) {
    error.value = e.message;
  }
});
</script>

<template>
  <section class="card">
    <h1>캐릭터 아이템 관리</h1>
    <p class="muted">캐릭터를 고르면 보유 아이템을 보고, 아이템·소지금을 지급하거나 회수할 수 있습니다. 지급하면 받은 회원에게 알림이 갑니다.</p>
    <p v-if="error" class="error">{{ error }}</p>
    <p v-if="message" class="ok">{{ message }}</p>

    <form class="filter-bar" @submit.prevent="loadCharacters">
      <input v-model="query" type="search" placeholder="캐릭터 이름, 아이디, 소통 계정" aria-label="캐릭터 검색" />
      <button type="submit" class="secondary">검색</button>
      <select v-model="ownerFilter" aria-label="이 아이템을 가진 캐릭터만">
        <option value="">보유 아이템: 전체 캐릭터</option>
        <option v-for="i in itemsByName" :key="i.id" :value="i.id">'{{ i.name }}' 가진 캐릭터만</option>
      </select>
      <span class="muted">{{ characters.length }}명</span>
    </form>

    <p v-if="!characters.length" class="muted">{{ ownerItem ? `'${ownerItem.name}'을(를) 가진 캐릭터가 없습니다.` : '캐릭터가 없습니다.' }}</p>
    <div v-else class="table-wrap">
      <table class="table">
        <thead>
          <tr>
            <th>캐릭터</th><th>아이디</th><th>아이템 종류</th><th>총 개수</th>
            <th v-if="ownerItem">'{{ ownerItem.name }}'</th>
            <th>소지금</th><th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="c in characters" :key="c.id" :class="{ checked: target?.id === c.id }">
            <td class="title-cell"><strong>{{ c.name }}</strong></td>
            <td>{{ c.username }}</td>
            <td>{{ c.itemKinds }}종</td>
            <td>{{ c.itemTotal }}개</td>
            <td v-if="ownerItem">{{ c.itemQuantity }}개</td>
            <td>{{ formatMoney(c.money) }}</td>
            <td class="row-actions">
              <button type="button" :class="target?.id === c.id ? '' : 'secondary'" @click="selectTarget(c)">{{ target?.id === c.id ? '보는 중' : '관리' }}</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>

  <section v-if="target" class="card target-panel">
    <div class="card-head">
      <h2>{{ target.name }} <span class="muted">({{ target.username }})</span></h2>
      <span class="money-badge">소지금 <strong>{{ formatMoney(money) }}</strong></span>
    </div>
    <p v-if="panelError" class="error">{{ panelError }}</p>

    <h3>아이템 지급</h3>
    <form class="add-row" @submit.prevent="giveItem">
      <input v-model="giveQuery" type="search" class="narrow-search" placeholder="아이템 검색" aria-label="지급할 아이템 검색" />
      <select v-model="give.itemId" required aria-label="지급할 아이템">
        <option value="" disabled>{{ giveChoices.length ? `지급할 아이템 선택 (${giveChoices.length}개)` : '검색 결과 없음' }}</option>
        <option v-for="item in giveChoices" :key="item.id" :value="item.id">{{ item.name }}</option>
      </select>
      <input v-model.number="give.quantity" class="narrow" type="number" min="1" max="99999" step="1" required title="수량" aria-label="수량" />
      <input v-model="give.memo" maxlength="100" placeholder="획득처 (예: 1차 이벤트 보상)" title="어디서 얻었는지 — 기록과 알림에 표시" />
      <button type="submit">지급</button>
    </form>

    <h3>보유 아이템 <span class="muted">{{ inventory.length }}종</span></h3>
    <p v-if="!inventory.length" class="muted">아이템이 없습니다.</p>
    <ul v-else class="post-list">
      <li v-for="entry in inventory" :key="entry.item.id" class="inv-row">
        <img v-if="entry.item.image" :src="entry.item.image" :alt="entry.item.name" class="item-icon" />
        <span class="post-title">{{ entry.item.name }} <span class="muted">x {{ entry.quantity }}</span>
          <span class="muted inv-acquired">최근 습득 {{ new Date(entry.lastAcquiredAt).toLocaleString('ko-KR') }} · {{ itemSourceLabel(entry.lastSource) }}<template v-if="entry.lastMemo"> ({{ entry.lastMemo }})</template></span>
        </span>
        <button type="button" class="danger small" @click="takeBack(entry)">회수</button>
      </li>
    </ul>

    <h3>소지금</h3>
    <form class="add-row" @submit.prevent>
      <input v-model.number="moneyForm.amount" class="money-input" type="number" min="1" step="1" placeholder="금액" required />
      <input v-model="moneyForm.memo" maxlength="100" placeholder="메모 (예: 이벤트 보상)" />
      <button type="button" :disabled="!moneyForm.amount" @click="changeMoney(1)">지급</button>
      <button type="button" class="danger" :disabled="!moneyForm.amount" @click="changeMoney(-1)">회수</button>
    </form>

    <details class="money-details" open>
      <summary>아이템 습득 · 사용 기록 (최근 30개)</summary>
      <ItemLogList :logs="itemLogs" show-actor />
    </details>
    <details class="money-details">
      <summary>최근 소지금 내역</summary>
      <MoneyLogList :logs="moneyLogs" />
    </details>
  </section>
</template>
