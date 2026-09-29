<script setup>
// 관리자: 상점 관리 — 등록된 아이템을 골라 가격·재고를 정해 상점에 올림
import { ref, reactive, computed, onMounted } from 'vue';
import { api } from '../../api';
import { formatMoney } from '../../items';

const listings = ref([]);
const items = ref([]);
const drafts = reactive({});   // listing id → { price, stock, isActive, sortOrder }
const error = ref('');
const message = ref('');
const newListing = ref({ itemId: '', price: 0, stock: '', sortOrder: 0, isActive: true });

// 아직 상점에 없는 아이템만 선택 가능
const available = computed(() => items.value.filter((i) => !listings.value.some((l) => l.item.id === i.id)));

const toDraft = (l) => ({ price: l.price, stock: l.stock === null ? '' : l.stock, isActive: l.isActive, sortOrder: l.sortOrder });
const isDirty = (l) => JSON.stringify(drafts[l.id]) !== JSON.stringify(toDraft(l));

function flash(text) {
  message.value = text;
  setTimeout(() => { if (message.value === text) message.value = ''; }, 2500);
}

async function load() {
  const [shop, itemList] = await Promise.all([api('/admin/shop'), api('/admin/items')]);
  listings.value = shop.listings;
  items.value = itemList.items;
  for (const l of listings.value) drafts[l.id] = toDraft(l);
}

async function run(fn, text) {
  error.value = '';
  try {
    await fn();
    await load();
    flash(text);
  } catch (e) {
    error.value = e.message;
  }
}

const add = () => {
  const item = items.value.find((i) => i.id === newListing.value.itemId);
  return run(async () => {
    await api('/admin/shop', { method: 'POST', body: newListing.value });
    newListing.value = { itemId: '', price: 0, stock: '', sortOrder: 0, isActive: true };
  }, `'${item?.name}' 상점에 등록했습니다.`);
};

const save = (l) => run(() => api(`/admin/shop/${l.id}`, { method: 'PUT', body: drafts[l.id] }), `'${l.item.name}' 저장했습니다.`);

const remove = (l) => confirm(`'${l.item.name}' 을(를) 상점에서 내릴까요? (아이템 자체와 이미 산 아이템은 그대로)`)
  && run(() => api(`/admin/shop/${l.id}`, { method: 'DELETE' }), `'${l.item.name}' 상점에서 내렸습니다.`);

onMounted(() => load().catch((e) => { error.value = e.message; }));
</script>

<template>
  <section class="card">
    <h1>상점 관리</h1>
    <p class="muted">
      <RouterLink to="/admin/items">아이템 관리</RouterLink>에 등록된 아이템을 골라 가격을 붙여 <RouterLink to="/shop">상점</RouterLink>에 올립니다.
      재고를 비워두면 무제한, 0 이면 품절입니다. '판매'를 끄면 상점에서 숨겨집니다.
    </p>
    <p v-if="error" class="error">{{ error }}</p>
    <p v-if="message" class="ok">{{ message }}</p>

    <form class="add-form" @submit.prevent="add">
      <h3>상품 추가</h3>
      <div class="add-row">
        <select v-model="newListing.itemId" required>
          <option value="" disabled>{{ available.length ? '아이템 선택' : '추가할 아이템이 없습니다' }}</option>
          <option v-for="i in available" :key="i.id" :value="i.id">[{{ i.id }}] {{ i.name }}</option>
        </select>
        <label class="inline">가격 <input v-model.number="newListing.price" class="money-input" type="number" min="0" step="1" required /></label>
        <label class="inline">재고 <input v-model="newListing.stock" class="narrow" type="number" min="0" step="1" placeholder="무제한" /></label>
        <label class="inline">순서 <input v-model.number="newListing.sortOrder" class="narrow" type="number" step="1" /></label>
        <label class="inline"><input v-model="newListing.isActive" type="checkbox" /> 판매</label>
        <button type="submit" :disabled="!available.length">추가</button>
      </div>
    </form>
  </section>

  <section class="card">
    <h2>상점 상품 {{ listings.length }}개</h2>
    <p v-if="!listings.length" class="muted">상점에 올린 상품이 없습니다.</p>
    <div v-else class="table-wrap">
      <table class="table">
        <thead><tr><th></th><th>아이템</th><th>가격</th><th>재고</th><th>순서</th><th>판매</th><th></th></tr></thead>
        <tbody>
          <tr v-for="l in listings" :key="l.id" :class="{ inactive: !drafts[l.id]?.isActive, dirty: drafts[l.id] && isDirty(l) }">
            <td><img v-if="l.item.smallImage" :src="l.item.smallImage" :alt="l.item.name" class="item-icon" /></td>
            <td class="title-cell">{{ l.item.name }} <span class="muted">uid {{ l.item.id }}</span></td>
            <td><input v-model.number="drafts[l.id].price" class="money-input" type="number" min="0" step="1" :title="formatMoney(drafts[l.id].price)" /></td>
            <td><input v-model="drafts[l.id].stock" class="narrow" type="number" min="0" step="1" placeholder="무제한" /></td>
            <td><input v-model.number="drafts[l.id].sortOrder" class="narrow" type="number" step="1" /></td>
            <td><input v-model="drafts[l.id].isActive" type="checkbox" /></td>
            <td class="row-actions">
              <button type="button" :disabled="!isDirty(l)" @click="save(l)">저장</button>
              <button type="button" class="danger" @click="remove(l)">내리기</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>
