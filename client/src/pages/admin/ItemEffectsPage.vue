<script setup>
// 관리자: 아이템 관리 → 아이템 효과 — 효과 종류 추가 / 수정 / 삭제
//   코드(프로그램용 키)는 만든 뒤 바꿀 수 없음. 삭제하면 그 효과를 쓰던 아이템은 '효과 없음'으로 바뀜
import { ref, onMounted } from 'vue';
import { api } from '../../api';
import { loadItemEffects } from '../../items';
import ModalDialog from '../../components/ModalDialog.vue';

const effects = ref([]);
const error = ref('');
const message = ref('');
const editing = ref(null);   // { isNew, code, label, example, description, sortOrder, error }
const saving = ref(false);

function flash(text) {
  message.value = text;
  setTimeout(() => { if (message.value === text) message.value = ''; }, 3000);
}

async function load() {
  effects.value = (await api('/admin/item-effects')).effects;
}

// 목록이 바뀌면 다른 화면(아이템 목록 등)의 효과 이름도 새로
async function setList(list) {
  effects.value = list;
  await loadItemEffects({ force: true });
}

const pretty = (json) => {
  try { return JSON.stringify(JSON.parse(json), null, 2); } catch { return json; }
};

function newEffect() {
  const maxOrder = Math.max(0, ...effects.value.map((e) => e.sortOrder));
  editing.value = { isNew: true, code: '', label: '', example: '{}', description: '', sortOrder: maxOrder + 10, error: '' };
}
function editEffect(e) {
  editing.value = { isNew: false, code: e.code, label: e.label, example: pretty(e.example), description: e.description, sortOrder: e.sortOrder, error: '' };
}

async function save() {
  const { isNew, code, ...body } = editing.value;
  editing.value.error = '';
  saving.value = true;
  try {
    const res = isNew
      ? await api('/admin/item-effects', { method: 'POST', body: { code, ...body } })
      : await api(`/admin/item-effects/${code}`, { method: 'PUT', body });
    await setList(res.effects);
    flash(`'${body.label}' 효과를 ${isNew ? '추가' : '수정'}했습니다.`);
    editing.value = null;
  } catch (e) {
    editing.value.error = e.message;
  } finally {
    saving.value = false;
  }
}

async function remove(e) {
  const used = e.itemCount ? `\n이 효과를 쓰는 아이템 ${e.itemCount}개는 '효과 없음'으로 바뀝니다. (효과수치는 남음)` : '';
  if (!confirm(`'${e.label}' (${e.code}) 효과를 삭제할까요?${used}`)) return;
  error.value = '';
  try {
    const res = await api(`/admin/item-effects/${e.code}`, { method: 'DELETE' });
    await setList(res.effects);
    flash(`'${e.label}' 효과를 삭제했습니다.${res.changedItems ? ` (아이템 ${res.changedItems}개 → 효과 없음)` : ''}`);
  } catch (err) {
    error.value = err.message;
  }
}

onMounted(() => load().catch((e) => { error.value = e.message; }));
</script>

<template>
  <section class="card">
    <div class="card-head">
      <h1>아이템 효과</h1>
      <button type="button" @click="newEffect">새 효과</button>
    </div>
    <p class="muted">
      아이템에 붙일 수 있는 효과 종류입니다. 아이템 목록에서 아이템을 수정할 때 여기 있는 효과 중 하나를 고르고, 효과수치(JSON)를 적습니다.
      '효과 없음'은 기본 효과라 지울 수 없습니다.
    </p>
    <p v-if="error" class="error">{{ error }}</p>
    <p v-if="message" class="ok">{{ message }}</p>

    <div class="table-wrap">
      <table class="table">
        <thead>
          <tr><th>순서</th><th>이름</th><th>코드</th><th>효과수치 예시</th><th>설명</th><th>쓰는 아이템</th><th></th></tr>
        </thead>
        <tbody>
          <tr v-for="e in effects" :key="e.code">
            <td>{{ e.sortOrder }}</td>
            <td class="title-cell"><strong>{{ e.label }}</strong></td>
            <td><code>{{ e.code }}</code></td>
            <td><code class="muted">{{ e.example }}</code></td>
            <td class="title-cell muted">{{ e.description }}</td>
            <td>{{ e.itemCount }}개</td>
            <td class="row-actions">
              <button type="button" class="secondary" @click="editEffect(e)">수정</button>
              <button v-if="e.code !== 'none'" type="button" class="danger" @click="remove(e)">삭제</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>

  <ModalDialog v-if="editing" :title="editing.isNew ? '새 효과' : `효과 수정 — ${editing.code}`" @close="editing = null">
    <template #actions>
      <button type="submit" form="effect-form" :disabled="saving">{{ saving ? '저장 중…' : '저장' }}</button>
      <button type="button" class="secondary" @click="editing = null">취소</button>
    </template>
    <form id="effect-form" class="form" @submit.prevent="save">
      <fieldset class="fieldset">
        <legend>효과</legend>
        <div class="field">
          <label for="effect-label">이름<span class="req">*</span> <span class="muted">(화면에 보이는 이름, 예: HP 회복)</span></label>
          <input id="effect-label" v-model="editing.label" required maxlength="50" />
        </div>
        <div class="field">
          <label for="effect-code">코드<span class="req">*</span> <span class="muted">(영문 소문자·숫자·_, 만든 뒤 바꿀 수 없음)</span></label>
          <input id="effect-code" v-model="editing.code" required pattern="[a-z][a-z0-9_]{1,29}" maxlength="30" placeholder="예: mp_recover" :disabled="!editing.isNew" />
        </div>
        <div class="field">
          <label for="effect-example">효과수치 예시 (JSON) <span class="muted">— 아이템 수정 화면의 '예시 넣기'로 들어감</span></label>
          <textarea id="effect-example" v-model="editing.example" rows="3" class="mono" placeholder='{"amount": 30}' />
        </div>
        <div class="field">
          <label for="effect-desc">설명 <span class="muted">(선택, 아이템 수정 화면에 보임)</span></label>
          <input id="effect-desc" v-model="editing.description" maxlength="255" />
        </div>
        <div class="field">
          <label for="effect-order">순서 <span class="muted">(작을수록 위)</span></label>
          <input id="effect-order" v-model.number="editing.sortOrder" class="narrow" type="number" step="1" />
        </div>
      </fieldset>
      <p v-if="editing.error" class="error">{{ editing.error }}</p>
    </form>
  </ModalDialog>
</template>
