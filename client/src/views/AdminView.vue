<script setup>
import { ref, reactive, onMounted } from 'vue';
import { api } from '../api';

const CATEGORIES = [
  { key: 'stats', category: 'stat', title: '스탯 항목', hint: '스탯 값은 정수로 저장됩니다.' },
  { key: 'details', category: 'detail', title: '세부정보 항목', hint: '값 형식: 숫자 또는 텍스트' },
];

const lists = ref({ stats: [], details: [] });
const error = ref('');
const message = ref('');
const newItem = reactive({
  stats: { code: '', label: '', valueType: 'number', isRequired: false, sortOrder: 0 },
  details: { code: '', label: '', valueType: 'text', isRequired: false, sortOrder: 0 },
});

async function load() {
  lists.value = await api('/admin/attributes');
}

function flash(text) {
  message.value = text;
  setTimeout(() => { if (message.value === text) message.value = ''; }, 2000);
}

async function add(key, category) {
  error.value = '';
  try {
    await api('/admin/attributes', { method: 'POST', body: { category, ...newItem[key] } });
    Object.assign(newItem[key], { code: '', label: '', isRequired: false, sortOrder: 0 });
    await load();
    flash('추가했습니다.');
  } catch (e) {
    error.value = e.message;
  }
}

async function update(item, changes) {
  error.value = '';
  try {
    await api(`/admin/attributes/${item.id}`, { method: 'PATCH', body: changes });
    await load();
    flash('저장했습니다.');
  } catch (e) {
    error.value = e.message;
    await load();
  }
}

onMounted(() => load().catch((e) => { error.value = e.message; }));
</script>

<template>
  <section class="card">
    <h1>캐릭터 항목 관리</h1>
    <p class="muted">
      캐릭터 스탯/세부정보로 어떤 값을 받을지 정합니다. 여기서 추가한 항목이 회원가입·마이페이지 입력칸에 바로 나타납니다.
      항목을 끄면(비활성) 입력/표시에서 숨겨지고, 이미 저장된 값은 DB 에 그대로 남습니다.
    </p>
    <p v-if="error" class="error">{{ error }}</p>
    <p v-if="message" class="ok">{{ message }}</p>
  </section>

  <section v-for="c in CATEGORIES" :key="c.key" class="card">
    <h2>{{ c.title }}</h2>
    <p class="muted">{{ c.hint }}</p>

    <div class="table-wrap">
      <table class="table">
        <thead>
          <tr><th>코드</th><th>표시 이름</th><th>형식</th><th>필수</th><th>순서</th><th>사용</th></tr>
        </thead>
        <tbody>
          <tr v-if="!lists[c.key].length"><td colspan="6" class="muted">항목이 없습니다.</td></tr>
          <tr v-for="item in lists[c.key]" :key="item.id" :class="{ inactive: !item.isActive }">
            <td><code>{{ item.code }}</code></td>
            <td><input :value="item.label" maxlength="100" @change="update(item, { label: $event.target.value })" /></td>
            <td>{{ item.valueType === 'number' ? '숫자' : '텍스트' }}</td>
            <td><input type="checkbox" :checked="item.isRequired" @change="update(item, { isRequired: $event.target.checked })" /></td>
            <td><input class="narrow" type="number" step="1" :value="item.sortOrder" @change="update(item, { sortOrder: Number($event.target.value) })" /></td>
            <td><input type="checkbox" :checked="item.isActive" @change="update(item, { isActive: $event.target.checked })" /></td>
          </tr>
        </tbody>
      </table>
    </div>

    <form class="add-row" @submit.prevent="add(c.key, c.category)">
      <input v-model="newItem[c.key].code" placeholder="코드 (예: str, birth_place)" required pattern="[a-z][a-z0-9_]{0,49}" title="영문 소문자로 시작, 영문 소문자/숫자/_" />
      <input v-model="newItem[c.key].label" placeholder="표시 이름 (예: 힘)" required maxlength="100" />
      <select v-if="c.category === 'detail'" v-model="newItem[c.key].valueType">
        <option value="text">텍스트</option>
        <option value="number">숫자</option>
      </select>
      <input v-model.number="newItem[c.key].sortOrder" class="narrow" type="number" step="1" title="정렬 순서" />
      <label class="inline"><input v-model="newItem[c.key].isRequired" type="checkbox" /> 필수</label>
      <button type="submit">추가</button>
    </form>
  </section>
</template>
