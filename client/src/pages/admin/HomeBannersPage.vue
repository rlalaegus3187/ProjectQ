<script setup>
// 관리자: 메인페이지 관리 → 배너 관리 — 배너 이미지 + 누르면 이동할 주소 (메인에 보일지는 '메인페이지 설정')
import { ref, onMounted } from 'vue';
import { api } from '../../api';
import ModalDialog from '../../components/ModalDialog.vue';
import ImageField from '../../components/ImageField.vue';

const banners = ref([]);
const error = ref('');
const message = ref('');
const editing = ref(null);   // { id?, image, title, link, sortOrder, error }
const saving = ref(false);

function flash(text) {
  message.value = text;
  setTimeout(() => { if (message.value === text) message.value = ''; }, 3000);
}
function newBanner() {
  const maxOrder = Math.max(0, ...banners.value.map((b) => b.sortOrder));
  editing.value = { image: '', title: '', link: '', sortOrder: maxOrder + 10, error: '' };
}
const editBanner = (b) => { editing.value = { ...b, error: '' }; };

async function save() {
  const { id, image, title, link, sortOrder } = editing.value;
  editing.value.error = '';
  saving.value = true;
  try {
    const body = { image, title, link, sortOrder };
    const res = id ? await api(`/admin/home/banners/${id}`, { method: 'PUT', body }) : await api('/admin/home/banners', { method: 'POST', body });
    banners.value = res.banners;
    flash(`배너를 ${id ? '수정' : '추가'}했습니다.`);
    editing.value = null;
  } catch (e) {
    editing.value.error = e.message;
  } finally {
    saving.value = false;
  }
}
async function remove(b) {
  if (!confirm(`배너${b.title ? ` '${b.title}'` : ''}를 삭제할까요?`)) return;
  try {
    banners.value = (await api(`/admin/home/banners/${b.id}`, { method: 'DELETE' })).banners;
    flash('배너를 삭제했습니다.');
  } catch (e) {
    error.value = e.message;
  }
}

onMounted(() => api('/admin/home/banners').then((r) => { banners.value = r.banners; }).catch((e) => { error.value = e.message; }));
</script>

<template>
  <section class="card">
    <div class="card-head">
      <h1>배너 관리</h1>
      <button type="button" @click="newBanner">새 배너</button>
    </div>
    <p class="muted">
      배너 이미지를 올리고, 누르면 이동할 주소를 적습니다. 사이트 안 주소(<code>/notice</code>)는 같은 창, <code>https://…</code> 는 새 탭으로 열립니다.
      여러 장이면 순서대로 넘어갑니다. 메인에 보일지는 <RouterLink to="/admin/home/modules">메인페이지 설정</RouterLink>에서.
    </p>
    <p v-if="error" class="error">{{ error }}</p>
    <p v-if="message" class="ok">{{ message }}</p>

    <p v-if="!banners.length" class="muted">배너가 없습니다. [새 배너]로 추가하세요.</p>
    <div v-else class="table-wrap">
      <table class="table">
        <thead><tr><th>순서</th><th>이미지</th><th>제목</th><th>이동할 주소</th><th></th></tr></thead>
        <tbody>
          <tr v-for="b in banners" :key="b.id">
            <td>{{ b.sortOrder }}</td>
            <td><img referrerpolicy="no-referrer" :src="b.image" :alt="b.title || '배너'" class="banner-thumb" /></td>
            <td class="title-cell">{{ b.title }}</td>
            <td class="title-cell"><a v-if="b.link" :href="b.link" target="_blank" rel="noopener">{{ b.link }}</a><span v-else class="muted">(이동 없음)</span></td>
            <td class="row-actions">
              <button type="button" class="secondary" @click="editBanner(b)">수정</button>
              <button type="button" class="danger" @click="remove(b)">삭제</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>

  <ModalDialog v-if="editing" :title="editing.id ? '배너 수정' : '새 배너'" @close="editing = null">
    <template #actions>
      <button type="submit" form="banner-form" :disabled="saving">{{ saving ? '저장 중…' : '저장' }}</button>
      <button type="button" class="secondary" @click="editing = null">취소</button>
    </template>
    <form id="banner-form" class="form" @submit.prevent="save">
      <fieldset class="fieldset">
        <legend>배너</legend>
        <div class="field">
          <span>이미지<span class="req">*</span> <span class="muted">(가로로 긴 그림 권장, 예: 1200×400)</span></span>
          <ImageField v-model="editing.image" alt="배너" />
        </div>
        <div class="field">
          <label for="banner-link">이동할 주소 <span class="muted">(이미지를 누르면 이동, 비우면 이동 없음)</span></label>
          <input id="banner-link" v-model="editing.link" maxlength="500" placeholder="/notice 또는 https://example.com" />
        </div>
        <div class="field">
          <label for="banner-title">제목 <span class="muted">(선택, 이미지 설명 — 화면 읽기·마우스 올림)</span></label>
          <input id="banner-title" v-model="editing.title" maxlength="100" />
        </div>
        <div class="field">
          <label for="banner-order">순서 <span class="muted">(작을수록 먼저)</span></label>
          <input id="banner-order" v-model.number="editing.sortOrder" class="narrow" type="number" step="1" />
        </div>
      </fieldset>
      <p v-if="editing.error" class="error">{{ editing.error }}</p>
    </form>
  </ModalDialog>
</template>
