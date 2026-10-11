<script setup>
// 마이페이지 → 표정 (채팅 두상) — 캐릭터 표정 여러 개 등록·수정·삭제
//   표정마다 이름 + 이미지(파일 또는 링크), 코드(<캐릭터 번호>_<번호>)는 자동
//   채팅 입력칸 옆에서 골라 말하면 메시지 옆에 이 이미지가 보임 (서버: server/src/faces.js)
import { ref, onMounted } from 'vue';
import { api } from '../api';
import ImageField from './ImageField.vue';
import ModalDialog from './ModalDialog.vue';

const faces = ref([]);
const max = ref(30);
const error = ref('');
const editing = ref(null);   // { id?, name, image, error, saving }

async function load() {
  const data = await api('/characters/me/faces');
  faces.value = data.faces;
  max.value = data.max;
}
const startNew = () => { editing.value = { name: faces.value.length ? '' : '기본', image: '', error: '', saving: false }; };
const startEdit = (f) => { editing.value = { ...f, error: '', saving: false }; };

async function save() {
  const e = editing.value;
  e.error = '';
  e.saving = true;
  try {
    const body = { name: e.name, image: e.image };
    const data = e.id
      ? await api(`/characters/me/faces/${e.id}`, { method: 'PUT', body })
      : await api('/characters/me/faces', { method: 'POST', body });
    faces.value = data.faces;
    editing.value = null;
  } catch (err) {
    e.error = err.message;
  } finally {
    e.saving = false;
  }
}
async function remove(f) {
  if (!confirm(`'${f.name}' 표정을 삭제할까요?\n이 표정으로 말한 채팅은 남고, 두상만 기본 모양(이름 첫 글자)으로 바뀝니다.`)) return;
  error.value = '';
  try {
    faces.value = (await api(`/characters/me/faces/${f.id}`, { method: 'DELETE' })).faces;
  } catch (err) {
    error.value = err.message;
  }
}

onMounted(() => load().catch((e) => { error.value = e.message; }));
</script>

<template>
  <section class="card">
    <div class="card-head">
      <h2>표정 <span class="muted">(채팅 두상 · {{ faces.length }}/{{ max }})</span></h2>
      <button type="button" :disabled="faces.length >= max" @click="startNew">표정 추가</button>
    </div>
    <p class="muted">채팅에서 입력칸 옆 [표정]을 눌러 고르고 말하면, 메시지 옆에 그 표정이 보입니다. 정사각형 이미지를 권장합니다.</p>
    <p v-if="error" class="error">{{ error }}</p>
    <p v-if="!faces.length" class="muted">아직 등록한 표정이 없습니다.</p>
    <ul v-else class="face-grid">
      <li v-for="f in faces" :key="f.id">
        <img :src="f.image" :alt="f.name" referrerpolicy="no-referrer" loading="lazy" />
        <strong>{{ f.name }}</strong>
        <code class="muted">{{ f.code }}</code>
        <span class="row-actions">
          <button type="button" class="secondary small" @click="startEdit(f)">수정</button>
          <button type="button" class="danger small" @click="remove(f)">삭제</button>
        </span>
      </li>
    </ul>
  </section>

  <ModalDialog v-if="editing" :title="editing.id ? '표정 수정' : '표정 추가'" @close="editing = null">
    <template #actions>
      <button type="submit" form="face-form" :disabled="editing.saving">{{ editing.saving ? '저장 중…' : '저장' }}</button>
      <button type="button" class="secondary" @click="editing = null">취소</button>
    </template>
    <form id="face-form" class="form" @submit.prevent="save">
      <div class="field">
        <label for="face-name">이름<span class="req">*</span></label>
        <input id="face-name" v-model="editing.name" required maxlength="30" placeholder="예: 기본, 웃음, 화남" />
      </div>
      <div class="field">
        <span>이미지<span class="req">*</span></span>
        <ImageField id="face-image" v-model="editing.image" alt="표정" />
      </div>
      <p v-if="editing.code" class="muted">코드 <code>{{ editing.code }}</code> (자동)</p>
      <p v-if="editing.error" class="error">{{ editing.error }}</p>
    </form>
  </ModalDialog>
</template>
