<script setup>
// 관리자: 칭호 관리 → 칭호 부여
//   칭호를 고르면 (주소 ?title=<번호>)
//   ① 이 칭호를 가진 캐릭터 — 체크해서 회수
//   ② 캐릭터 찾기 — 체크해서 한 번에 부여 (받은 회원에게 알림, 이미 가진 캐릭터는 건너뜀)
import { ref, computed, watch, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api } from '../../api';
import { formatDate } from '../../boards';
import BulkBar from '../../components/BulkBar.vue';
import TitleBadge from '../../components/TitleBadge.vue';
import { useSelection } from '../../selection';

const route = useRoute();
const router = useRouter();
const titles = ref([]);
const holders = ref([]);
const characters = ref([]);   // 검색 결과
const query = ref('');
const memo = ref('');
const error = ref('');
const message = ref('');
const busy = ref(false);

function flash(text) {
  message.value = text;
  setTimeout(() => { if (message.value === text) message.value = ''; }, 3500);
}

// 고른 칭호 — 주소 ?title= 와 연결
const titleId = computed({
  get: () => (route.query.title ? Number(route.query.title) : ''),
  set: (id) => router.replace({ query: { ...route.query, title: id || undefined } }),
});
const title = computed(() => titles.value.find((t) => t.id === titleId.value) ?? null);
const holderIds = computed(() => new Set(holders.value.map((h) => h.id)));
// 부여 후보: 아직 이 칭호가 없는 캐릭터
const candidates = computed(() => characters.value.filter((c) => !holderIds.value.has(c.id)));

const holderSel = useSelection(() => holders.value);
const grantSel = useSelection(() => candidates.value);

async function loadTitles() {
  titles.value = (await api('/admin/titles')).titles;
}
async function loadHolders() {
  holderSel.clear();
  holders.value = title.value ? (await api(`/admin/titles/${title.value.id}/holders`)).holders : [];
}
async function search() {
  grantSel.clear();
  characters.value = (await api(`/admin/characters?q=${encodeURIComponent(query.value)}`)).characters;
}

async function run(fn) {
  error.value = '';
  busy.value = true;
  try {
    await fn();
  } catch (e) {
    error.value = e.message;
  } finally {
    busy.value = false;
  }
}

const grant = () => run(async () => {
  const ids = grantSel.ids.value;
  const res = await api(`/admin/titles/${title.value.id}/grant`, { method: 'POST', body: { characterIds: ids, memo: memo.value } });
  flash(`'${title.value.name}' 칭호를 ${res.granted}명에게 부여했습니다. (알림 발송)${res.skipped ? ` — 이미 가진 ${res.skipped}명은 건너뜀` : ''}`);
  grantSel.clear();
  memo.value = '';   // 사유는 한 번 부여에만 (다른 칭호에 따라가지 않게)
  await Promise.all([loadHolders(), loadTitles()]);
});

const revoke = (ids) => run(async () => {
  const names = holders.value.filter((h) => ids.includes(h.id)).map((h) => h.name);
  if (!confirm(`${names.join(', ')}\n\n위 ${ids.length}명에게서 '${title.value.name}' 칭호를 회수할까요? (대표 칭호였으면 대표도 해제됨)`)) return;
  const res = await api(`/admin/titles/${title.value.id}/revoke`, { method: 'POST', body: { characterIds: ids } });
  flash(`${res.revoked}명에게서 '${title.value.name}' 칭호를 회수했습니다.`);
  await Promise.all([loadHolders(), loadTitles()]);
});

watch(titleId, () => {
  memo.value = '';
  loadHolders().catch((e) => { error.value = e.message; });
});
onMounted(async () => {
  try {
    await Promise.all([loadTitles(), search()]);
    if (!titleId.value && titles.value[0]) titleId.value = titles.value[0].id;
    else await loadHolders();
  } catch (e) {
    error.value = e.message;
  }
});
</script>

<template>
  <section class="card">
    <h1>칭호 부여</h1>
    <p v-if="error" class="error">{{ error }}</p>
    <p v-if="message" class="ok">{{ message }}</p>
    <p v-if="!titles.length" class="muted">칭호가 없습니다. <RouterLink to="/admin/titles/list">칭호 목록</RouterLink>에서 먼저 만들어주세요.</p>
    <div v-else class="filter-bar">
      <select v-model="titleId" aria-label="칭호 선택">
        <option v-for="t in titles" :key="t.id" :value="t.id">{{ t.name }} ({{ t.holderCount }}명)</option>
      </select>
      <TitleBadge v-if="title" :title="title" />
      <span v-if="title?.description" class="muted">{{ title.description }}</span>
    </div>
  </section>

  <template v-if="title">
    <!-- ① 가진 캐릭터 -->
    <section class="card">
      <h2>이 칭호를 가진 캐릭터 <span class="muted">{{ holders.length }}명</span></h2>
      <p v-if="!holders.length" class="muted">아직 아무도 없습니다. 아래에서 캐릭터를 골라 부여하세요.</p>
      <BulkBar v-if="holders.length" :count="holderSel.ids.value.length" @clear="holderSel.clear()">
        <button type="button" class="danger" :disabled="busy || !holderSel.ids.value.length" @click="revoke(holderSel.ids.value)">선택 회수</button>
      </BulkBar>
      <div v-if="holders.length" class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th class="check"><input type="checkbox" aria-label="전체 선택" :checked="holderSel.allChecked.value" :indeterminate="holderSel.someChecked.value" @change="holderSel.toggleAll()" /></th>
              <th>캐릭터</th><th>아이디</th><th>사유</th><th>받은 날</th><th>대표</th><th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="h in holders" :key="h.id" :class="{ checked: holderSel.has(h.id) }">
              <td class="check"><input type="checkbox" :aria-label="`${h.name} 선택`" :checked="holderSel.has(h.id)" @change="holderSel.toggle(h.id)" /></td>
              <td class="title-cell"><RouterLink :to="`/members/${h.id}`"><strong>{{ h.name }}</strong></RouterLink></td>
              <td>{{ h.username }}</td>
              <td class="title-cell muted">{{ h.memo }}</td>
              <td>{{ formatDate(h.grantedAt) }}</td>
              <td>{{ h.isMain ? '대표' : '' }}</td>
              <td class="row-actions"><button type="button" class="danger" :disabled="busy" @click="revoke([h.id])">회수</button></td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- ② 캐릭터 찾아서 부여 -->
    <section class="card">
      <h2>캐릭터에게 부여</h2>
      <form class="filter-bar" @submit.prevent="search">
        <input v-model="query" type="search" placeholder="캐릭터 이름, 아이디, 소통 계정" aria-label="캐릭터 검색" />
        <button type="submit" class="secondary">검색</button>
        <span class="muted">{{ candidates.length }}명 (이미 가진 캐릭터 제외)</span>
      </form>
      <p v-if="!candidates.length" class="muted">부여할 수 있는 캐릭터가 없습니다.</p>
      <BulkBar v-if="candidates.length" :count="grantSel.ids.value.length" @clear="grantSel.clear()">
        <input v-model="memo" class="bulk-memo" maxlength="100" placeholder="사유 (선택, 예: 1차 이벤트 우승)" aria-label="부여 사유" />
        <button type="button" :disabled="busy || !grantSel.ids.value.length" @click="grant">선택한 캐릭터에게 부여</button>
      </BulkBar>
      <div v-if="candidates.length" class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th class="check"><input type="checkbox" aria-label="전체 선택" :checked="grantSel.allChecked.value" :indeterminate="grantSel.someChecked.value" @change="grantSel.toggleAll()" /></th>
              <th>캐릭터</th><th>아이디</th><th>소통 계정</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="c in candidates" :key="c.id" :class="{ checked: grantSel.has(c.id) }" @click="grantSel.toggle(c.id)">
              <td class="check"><input type="checkbox" :aria-label="`${c.name} 선택`" :checked="grantSel.has(c.id)" @click.stop @change="grantSel.toggle(c.id)" /></td>
              <td class="title-cell"><strong>{{ c.name }}</strong></td>
              <td>{{ c.username }}</td>
              <td class="muted">{{ c.contact }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </template>
</template>
