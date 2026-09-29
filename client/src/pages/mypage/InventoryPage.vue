<script setup>
// 내 캐릭터 인벤토리 (인벤토리는 캐릭터에 귀속)
import { ref, onMounted } from 'vue';
import { api } from '../../api';
import { formatMoney } from '../../items';
import ItemDetail from '../../components/ItemDetail.vue';
import MoneyLogList from '../../components/MoneyLogList.vue';
import ModalDialog from '../../components/ModalDialog.vue';

const inventory = ref(null);
const money = ref(0);
const moneyLogs = ref([]);
const error = ref('');
const selected = ref(null);   // { item, quantity }
const discardQty = ref(1);
const busy = ref(false);

async function load() {
  error.value = '';
  try {
    const data = await api('/inventory');
    inventory.value = data.inventory;
    money.value = data.money;
    moneyLogs.value = data.moneyLogs;
  } catch (e) {
    error.value = e.message;
  }
}

function open(entry) {
  selected.value = entry;
  discardQty.value = 1;
}

async function discard() {
  const { item } = selected.value;
  if (!confirm(`'${item.name}' ${discardQty.value}개를 버릴까요? 되돌릴 수 없습니다.`)) return;
  busy.value = true;
  try {
    const { quantity } = await api(`/inventory/${item.id}/discard`, { method: 'POST', body: { quantity: discardQty.value } });
    selected.value = quantity > 0 ? { ...selected.value, quantity } : null;
    await load();
  } catch (e) {
    alert(e.message);
  } finally {
    busy.value = false;
  }
}

onMounted(load);
</script>

<template>
  <section class="card">
    <div class="card-head">
      <h1>인벤토리</h1>
      <span v-if="inventory" class="money-badge">소지금 <strong>{{ formatMoney(money) }}</strong></span>
    </div>
    <p v-if="error" class="error">{{ error }} <RouterLink v-if="error.includes('캐릭터')" to="/mypage">캐릭터 만들기</RouterLink></p>
    <p v-else-if="!inventory" class="muted">불러오는 중…</p>
    <p v-else-if="!inventory.length" class="muted">아이템이 없습니다.</p>
    <ul v-else class="item-grid">
      <li v-for="entry in inventory" :key="entry.item.id">
        <button type="button" class="item-slot" :title="entry.item.name" @click="open(entry)">
          <img v-if="entry.item.smallImage" :src="entry.item.smallImage" :alt="entry.item.name" />
          <span v-else class="item-noimg">{{ entry.item.name.slice(0, 2) }}</span>
          <span v-if="entry.quantity > 1" class="item-qty">{{ entry.quantity }}</span>
          <span v-if="entry.item.isBound" class="item-bound" title="귀속">귀속</span>
          <span class="item-name">{{ entry.item.name }}</span>
        </button>
      </li>
    </ul>
  </section>

  <section v-if="inventory" class="card">
    <div class="card-head">
      <h2>소지금 내역</h2>
      <RouterLink to="/shop" class="button secondary">상점 가기</RouterLink>
    </div>
    <MoneyLogList :logs="moneyLogs" />
  </section>

  <ModalDialog v-if="selected" :title="selected.item.name" @close="selected = null">
    <ItemDetail :item="selected.item" :quantity="selected.quantity" />
    <form class="discard-row" @submit.prevent="discard">
      <input v-model.number="discardQty" class="narrow" type="number" min="1" :max="selected.quantity" step="1" required />
      <button type="submit" class="danger" :disabled="busy">버리기</button>
    </form>
  </ModalDialog>
</template>
