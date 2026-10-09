<script setup>
// 상점: 판매 중인 상품 목록 + 구매 (로그인한 회원, 소지금으로)
import { ref, computed, onMounted } from 'vue';
import { api } from '../../api';
import { auth } from '../../auth';
import { formatMoney } from '../../items';
import ItemDetail from '../../components/ItemDetail.vue';
import ModalDialog from '../../components/ModalDialog.vue';

const listings = ref(null);
const money = ref(null);
const error = ref('');
const selected = ref(null);
const quantity = ref(1);
const buying = ref(false);
const buyError = ref('');
const message = ref('');

const total = computed(() => (selected.value ? selected.value.price * (Number(quantity.value) || 0) : 0));
const maxQty = computed(() => (selected.value?.stock ?? 99999) || 0);

async function load() {
  error.value = '';
  try {
    const data = await api('/shop');
    listings.value = data.listings;
    money.value = data.money;
  } catch (e) {
    error.value = e.message;
  }
}

function open(listing) {
  selected.value = listing;
  quantity.value = 1;
  buyError.value = '';
}

async function buy() {
  buyError.value = '';
  buying.value = true;
  try {
    const r = await api(`/shop/${selected.value.id}/buy`, { method: 'POST', body: { quantity: quantity.value } });
    money.value = r.money;
    message.value = `'${r.itemName}' ${quantity.value}개를 샀습니다. (-${formatMoney(r.total)}) 인벤토리 보유 ${r.owned}개`;
    selected.value = null;
    await load();
  } catch (e) {
    buyError.value = e.message;
  } finally {
    buying.value = false;
  }
}

onMounted(load);
</script>

<template>
  <section class="card">
    <div class="card-head">
      <h1>상점</h1>
      <span v-if="money !== null" class="money-badge">소지금 <strong>{{ formatMoney(money) }}</strong></span>
    </div>
    <p v-if="!auth.user" class="muted"><RouterLink :to="{ path: '/login', query: { redirect: '/shop' } }">로그인</RouterLink>하면 구매할 수 있습니다.</p>
    <p v-if="message" class="ok">{{ message }} <RouterLink to="/inventory">인벤토리 보기</RouterLink></p>
    <p v-if="error" class="error">{{ error }}</p>
    <p v-else-if="!listings" class="muted">불러오는 중…</p>
    <p v-else-if="!listings.length" class="muted">판매 중인 상품이 없습니다.</p>

    <ul v-else class="shop-grid">
      <li v-for="l in listings" :key="l.id">
        <button type="button" class="shop-card" :class="{ soldout: l.stock === 0 }" @click="open(l)">
          <span class="shop-thumb">
            <img v-if="l.item.image" :src="l.item.image" :alt="l.item.name" />
            <span v-else class="item-noimg">{{ l.item.name.slice(0, 2) }}</span>
          </span>
          <strong class="shop-name">{{ l.item.name }}</strong>
          <span class="shop-price">{{ formatMoney(l.price) }}</span>
          <span class="muted shop-stock">{{ l.stock === null ? '' : l.stock === 0 ? '품절' : `남은 수량 ${l.stock}` }}</span>
        </button>
      </li>
    </ul>
  </section>

  <ModalDialog v-if="selected" :title="selected.item.name" @close="selected = null">
    <ItemDetail :item="selected.item" />
    <form class="buy-row" @submit.prevent="buy">
      <span class="muted">가격 {{ formatMoney(selected.price) }}<template v-if="selected.stock !== null"> · 남은 수량 {{ selected.stock }}</template></span>
      <template v-if="auth.user && selected.stock !== 0">
        <input v-model.number="quantity" class="narrow" type="number" min="1" :max="maxQty" step="1" required />
        <strong>합계 {{ formatMoney(total) }}</strong>
        <button type="submit" :disabled="buying || (money !== null && total > money)">
          {{ money !== null && total > money ? '소지금 부족' : buying ? '구매 중…' : '구매' }}
        </button>
      </template>
      <strong v-else-if="selected.stock === 0">품절</strong>
      <RouterLink v-else :to="{ path: '/login', query: { redirect: '/shop' } }" class="button">로그인하고 구매</RouterLink>
    </form>
    <p v-if="buyError" class="error">{{ buyError }}</p>
  </ModalDialog>
</template>
