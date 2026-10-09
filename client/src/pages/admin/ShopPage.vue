<script setup>
// 관리자: 상점 관리 — 등록된 아이템을 골라 가격·재고를 정해 상점에 올림
import { ref, reactive, computed, onMounted } from 'vue';
import { api } from '../../api';
import { formatMoney } from '../../items';
import { useSelection } from '../../selection';
import BulkBar from '../../components/BulkBar.vue';
import ToggleSwitch from '../../components/ToggleSwitch.vue';

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

// ---------- 일괄 처리 (체크한 상품) ----------
const sel = useSelection(() => listings.value);
const chosen = () => listings.value.filter((l) => sel.has(l.id));

// 체크한 상품의 입력칸(가격·재고·순서·판매)을 한꺼번에 저장
const bulkSave = () => {
  const rows = chosen().map((l) => ({ id: l.id, ...drafts[l.id] }));
  return run(async () => { await api('/admin/shop/bulk', { method: 'PUT', body: { items: rows } }); sel.clear(); }, `${rows.length}개 상품을 저장했습니다.`);
};
const bulkActive = (isActive) => {
  const ids = sel.ids.value;
  return run(async () => { await api('/admin/shop/bulk', { method: 'PATCH', body: { ids, isActive } }); sel.clear(); },
    `${ids.length}개 상품 판매를 ${isActive ? '켰습니다' : '껐습니다'}.`);
};
const bulkRemove = () => {
  const list = chosen();
  return confirm(`${list.length}개 상품을 상점에서 내릴까요?\n${list.map((l) => l.item.name).join(', ')}\n(아이템 자체와 이미 산 아이템은 그대로)`)
    && run(async () => { await api('/admin/shop/bulk-delete', { method: 'POST', body: { ids: list.map((l) => l.id) } }); sel.clear(); },
      `${list.length}개 상품을 상점에서 내렸습니다.`);
};

onMounted(() => load().catch((e) => { error.value = e.message; }));
</script>

<template>
  <section class="card">
    <h1>상점 관리</h1>
    <p class="muted">
      <RouterLink to="/admin/items/list">아이템 관리</RouterLink>에 등록된 아이템을 골라 가격을 붙여 <RouterLink to="/shop">상점</RouterLink>에 올립니다.
      재고를 비워두면 무제한, 0 이면 품절입니다. '판매'를 끄면 상점에서 숨겨집니다.
    </p>
    <p v-if="error" class="error">{{ error }}</p>
    <p v-if="message" class="ok">{{ message }}</p>

    <form class="add-form" @submit.prevent="add">
      <h3>상품 추가</h3>
      <div class="add-row">
        <select v-model="newListing.itemId" required>
          <option value="" disabled>{{ available.length ? '아이템 선택' : '추가할 아이템이 없습니다' }}</option>
          <option v-for="i in available" :key="i.id" :value="i.id">{{ i.name }}</option>
        </select>
        <label class="inline">가격 <input v-model.number="newListing.price" class="money-input" type="number" min="0" step="1" required /></label>
        <label class="inline">재고 <input v-model="newListing.stock" class="narrow" type="number" min="0" step="1" placeholder="무제한" /></label>
        <label class="inline">순서 <input v-model.number="newListing.sortOrder" class="narrow" type="number" step="1" /></label>
        <label class="toggle"><ToggleSwitch v-model="newListing.isActive" /> 판매</label>
        <button type="submit" :disabled="!available.length">추가</button>
      </div>
    </form>
  </section>

  <section class="card">
    <h2>상점 상품 {{ listings.length }}개</h2>
    <p v-if="!listings.length" class="muted">상점에 올린 상품이 없습니다.</p>
    <BulkBar v-if="listings.length" :count="sel.ids.value.length" @clear="sel.clear()">
      <button type="button" :disabled="!sel.ids.value.length" @click="bulkSave">선택 저장</button>
      <button type="button" class="secondary" :disabled="!sel.ids.value.length" @click="bulkActive(true)">판매 켜기</button>
      <button type="button" class="secondary" :disabled="!sel.ids.value.length" @click="bulkActive(false)">판매 끄기</button>
      <button type="button" class="danger" :disabled="!sel.ids.value.length" @click="bulkRemove">선택 내리기</button>
    </BulkBar>
    <div v-if="listings.length" class="table-wrap">
      <table class="table">
        <thead>
          <tr>
            <th class="check"><input type="checkbox" aria-label="전체 선택" :checked="sel.allChecked.value" :indeterminate="sel.someChecked.value" @change="sel.toggleAll()" /></th>
            <th>이미지</th><th>아이템</th><th>가격</th><th>재고</th><th>순서</th><th>판매</th><th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="l in listings" :key="l.id" :class="{ inactive: !drafts[l.id]?.isActive, dirty: drafts[l.id] && isDirty(l), checked: sel.has(l.id) }">
            <td class="check"><input type="checkbox" :aria-label="`${l.item.name} 선택`" :checked="sel.has(l.id)" @change="sel.toggle(l.id)" /></td>
            <td><img v-if="l.item.image" :src="l.item.image" :alt="l.item.name" class="item-icon" /></td>
            <td class="title-cell">{{ l.item.name }}</td>
            <td><input v-model.number="drafts[l.id].price" class="money-input" type="number" min="0" step="1" :title="formatMoney(drafts[l.id].price)" /></td>
            <td><input v-model="drafts[l.id].stock" class="narrow" type="number" min="0" step="1" placeholder="무제한" /></td>
            <td><input v-model.number="drafts[l.id].sortOrder" class="narrow" type="number" step="1" /></td>
            <td><ToggleSwitch v-model="drafts[l.id].isActive" :label="`${l.item.name} 판매`" /></td>
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
