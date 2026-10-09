<script setup>
// 관리자: 칭호 관리 → 칭호 목록 — 칭호 추가 / 수정 / 삭제 (색·설명·순서)
// 캐릭터에게 주는 건 '칭호 부여' 소탭
import { ref, computed, onMounted } from 'vue';
import { api } from '../../api';
import ModalDialog from '../../components/ModalDialog.vue';
import BulkBar from '../../components/BulkBar.vue';
import TitleBadge from '../../components/TitleBadge.vue';
import { useSelection } from '../../selection';

const DEFAULT_COLOR = '#2563eb';
const titles = ref([]);
const query = ref('');
const error = ref('');
const message = ref('');
const editing = ref(null);   // { id?, name, description, useColor, color, sortOrder, error }
const saving = ref(false);

function flash(text) {
  message.value = text;
  setTimeout(() => { if (message.value === text) message.value = ''; }, 3000);
}

const shown = computed(() => {
  const q = query.value.trim().toLowerCase();
  return titles.value.filter((t) => !q || t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q));
});
const sel = useSelection(() => shown.value);

async function load() {
  titles.value = (await api('/admin/titles')).titles;
}

function newTitle() {
  const maxOrder = Math.max(0, ...titles.value.map((t) => t.sortOrder));
  editing.value = { name: '', description: '', useColor: false, color: DEFAULT_COLOR, sortOrder: maxOrder + 10, error: '' };
}
function editTitle(t) {
  editing.value = {
    id: t.id, name: t.name, description: t.description, useColor: !!t.color, color: t.color || DEFAULT_COLOR, sortOrder: t.sortOrder, error: '',
  };
}
// 팝업 미리보기
const preview = computed(() => editing.value && { name: editing.value.name || '칭호 이름', color: editing.value.useColor ? editing.value.color : null });

async function save() {
  const { id, name, description, useColor, color, sortOrder } = editing.value;
  editing.value.error = '';
  saving.value = true;
  try {
    const body = { name, description, color: useColor ? color : '', sortOrder };
    const res = id
      ? await api(`/admin/titles/${id}`, { method: 'PUT', body })
      : await api('/admin/titles', { method: 'POST', body });
    titles.value = res.titles;
    flash(`'${name}' 칭호를 ${id ? '수정' : '추가'}했습니다.`);
    editing.value = null;
  } catch (e) {
    editing.value.error = e.message;
  } finally {
    saving.value = false;
  }
}

async function remove(t) {
  const extra = t.holderCount ? `\n이 칭호를 가진 캐릭터 ${t.holderCount}명에게서도 사라집니다.` : '';
  if (!confirm(`'${t.name}' 칭호를 삭제할까요?${extra}\n되돌릴 수 없습니다.`)) return;
  error.value = '';
  try {
    titles.value = (await api(`/admin/titles/${t.id}`, { method: 'DELETE' })).titles;
    flash(`'${t.name}' 칭호를 삭제했습니다.`);
  } catch (e) {
    error.value = e.message;
  }
}

async function bulkRemove() {
  const chosen = titles.value.filter((t) => sel.has(t.id));
  const holders = chosen.reduce((n, t) => n + t.holderCount, 0);
  if (!confirm(`${chosen.length}개 칭호를 삭제할까요?\n${chosen.map((t) => t.name).join(', ')}${holders ? `\n\n가진 캐릭터(${holders}건)에게서도 사라집니다.` : ''}\n되돌릴 수 없습니다.`)) return;
  error.value = '';
  try {
    const res = await api('/admin/titles/bulk-delete', { method: 'POST', body: { ids: chosen.map((t) => t.id) } });
    titles.value = res.titles;
    sel.clear();
    flash(`${res.deleted}개 칭호를 삭제했습니다.`);
  } catch (e) {
    error.value = e.message;
  }
}

onMounted(() => load().catch((e) => { error.value = e.message; }));
</script>

<template>
  <section class="card">
    <div class="card-head">
      <h1>칭호 목록</h1>
      <button type="button" @click="newTitle">새 칭호</button>
    </div>
    <p class="muted">
      캐릭터에게 줄 칭호를 만듭니다. 캐릭터에게 주는 건 <RouterLink to="/admin/titles/grant">칭호 부여</RouterLink>에서 합니다.
      받은 캐릭터는 마이페이지에서 하나를 <strong>대표 칭호</strong>로 골라 이름 옆에 표시할 수 있습니다.
    </p>
    <p v-if="error" class="error">{{ error }}</p>
    <p v-if="message" class="ok">{{ message }}</p>

    <div class="filter-bar">
      <input v-model="query" type="search" placeholder="칭호 검색 (이름 · 설명)" aria-label="칭호 검색" />
      <span class="muted">{{ query ? `${shown.length} / ${titles.length}개` : `${titles.length}개` }}</span>
    </div>

    <p v-if="!titles.length" class="muted">칭호가 없습니다. [새 칭호]로 만들어주세요.</p>
    <p v-else-if="!shown.length" class="muted">조건에 맞는 칭호가 없습니다.</p>
    <BulkBar v-if="shown.length" :count="sel.ids.value.length" @clear="sel.clear()">
      <button type="button" class="danger" :disabled="!sel.ids.value.length" @click="bulkRemove">선택 삭제</button>
    </BulkBar>
    <div v-if="shown.length" class="table-wrap">
      <table class="table">
        <thead>
          <tr>
            <th class="check"><input type="checkbox" aria-label="전체 선택" :checked="sel.allChecked.value" :indeterminate="sel.someChecked.value" @change="sel.toggleAll()" /></th>
            <th>순서</th><th>칭호</th><th>설명</th><th>가진 캐릭터</th><th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="t in shown" :key="t.id" :class="{ checked: sel.has(t.id) }">
            <td class="check"><input type="checkbox" :aria-label="`${t.name} 선택`" :checked="sel.has(t.id)" @change="sel.toggle(t.id)" /></td>
            <td>{{ t.sortOrder }}</td>
            <td><TitleBadge :title="t" /></td>
            <td class="title-cell muted">{{ t.description }}</td>
            <td>
              <RouterLink :to="{ path: '/admin/titles/grant', query: { title: t.id } }" title="이 칭호를 가진 캐릭터 보기 · 부여">{{ t.holderCount }}명</RouterLink>
            </td>
            <td class="row-actions">
              <button type="button" class="secondary" @click="editTitle(t)">수정</button>
              <button type="button" class="danger" @click="remove(t)">삭제</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>

  <ModalDialog v-if="editing" :title="editing.id ? '칭호 수정' : '새 칭호'" @close="editing = null">
    <template #actions>
      <button type="submit" form="title-form" :disabled="saving">{{ saving ? '저장 중…' : '저장' }}</button>
      <button type="button" class="secondary" @click="editing = null">취소</button>
    </template>
    <form id="title-form" class="form" @submit.prevent="save">
      <fieldset class="fieldset">
        <legend>칭호</legend>
        <div class="field">
          <label for="title-name">이름<span class="req">*</span></label>
          <input id="title-name" v-model="editing.name" required maxlength="50" placeholder="예: 용사의 증표" />
        </div>
        <div class="field">
          <label for="title-desc">설명 <span class="muted">(선택, 배지에 마우스를 올리면 보임)</span></label>
          <textarea id="title-desc" v-model="editing.description" rows="2" maxlength="500" />
        </div>
        <div class="field">
          <span>배지 색</span>
          <div class="title-color-row">
            <label class="inline"><input v-model="editing.useColor" type="checkbox" /> 색 지정</label>
            <input v-if="editing.useColor" v-model="editing.color" type="color" aria-label="배지 색" />
            <span class="muted">{{ editing.useColor ? editing.color : '기본 (사이트 강조색)' }}</span>
          </div>
        </div>
        <div class="field">
          <label for="title-order">순서 <span class="muted">(작을수록 위)</span></label>
          <input id="title-order" v-model.number="editing.sortOrder" class="narrow" type="number" step="1" />
        </div>
        <div class="field">
          <span>미리보기</span>
          <div><TitleBadge :title="preview" /></div>
        </div>
      </fieldset>
      <p v-if="editing.error" class="error">{{ editing.error }}</p>
    </form>
  </ModalDialog>
</template>
