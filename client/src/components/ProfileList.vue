<script setup>
// 마이페이지: 내 프로필 목록 — 대표 프로필 표시, 보기 / 수정(팝업) / 대표로 지정 / 삭제, 새 프로필(팝업)
// 프로필 내용은 프로필 페이지(/members/:id)에서 보고, 다른 사람도 목록에서 골라 볼 수 있음
import { ref, computed } from 'vue';
import { api } from '../api';
import ModalDialog from './ModalDialog.vue';
import ProfileFormModal from './ProfileFormModal.vue';
import ProfileView from './ProfileView.vue';

const props = defineProps({
  character: { type: Object, required: true },
  definitions: { type: Object, required: true },
  readonly: { type: Boolean, default: false },   // 신청서 잠금(작성완료) 등
  publicPage: { type: Boolean, default: true },  // 프로필 페이지가 공개인지 (신청자는 관리자만 볼 수 있어 팝업으로 보기)
});
const emit = defineEmits(['updated']);

const editing = ref(undefined);   // undefined: 닫힘, null: 새 프로필, 객체: 그 프로필 수정
const viewing = ref(null);
const busy = ref(false);
const error = ref('');

const profiles = computed(() => props.character.profiles);
const maxProfiles = computed(() => props.character.maxProfiles ?? 10);
const label = (p) => (p.isMain ? props.character.name : p.name);
const fieldCount = (p) => p.details.filter((d) => d.value !== null && d.value !== '').length;

function onSaved(character) {
  editing.value = undefined;
  emit('updated', character);
}

async function run(fn) {
  error.value = '';
  busy.value = true;
  try {
    const { character } = await fn();
    emit('updated', character);
  } catch (e) {
    error.value = e.message;
  } finally {
    busy.value = false;
  }
}

const makeMain = (p) => run(() => api(`/characters/me/profiles/${p.id}/main`, { method: 'PUT' }));
const remove = (p) => confirm(`'${label(p)}' 프로필을 삭제할까요? 되돌릴 수 없습니다.`)
  && run(() => api(`/characters/me/profiles/${p.id}`, { method: 'DELETE' }));
</script>

<template>
  <section class="card">
    <div class="card-head">
      <h2>내 프로필 <span class="muted">{{ profiles.length }} / {{ maxProfiles }}</span></h2>
      <button v-if="!readonly && profiles.length < maxProfiles" type="button" class="secondary" @click="editing = null">+ 새 프로필</button>
    </div>
    <p class="muted">
      <strong>대표 프로필</strong>이 캐릭터 페이지에 먼저 보이고, 다른 프로필은 캐릭터 페이지 위쪽 목록에서 골라 볼 수 있습니다. 프로필마다 음악을 따로 정할 수 있습니다.
    </p>

    <ul class="profile-list">
      <li v-for="p in profiles" :key="p.id" :class="{ main: p.isMain }">
        <div class="profile-list-info">
          <strong><span v-if="p.isMain" class="badge pin">대표</span> {{ label(p) }}</strong>
          <span class="muted">항목 {{ fieldCount(p) }}개 입력<template v-if="p.musicVideoId"> · ♪ 음악</template></span>
        </div>
        <div class="actions">
          <RouterLink v-if="publicPage" :to="{ path: `/members/${character.id}`, query: p.isMain ? {} : { profile: p.id } }" class="button secondary small">보기</RouterLink>
          <button v-else type="button" class="secondary small" @click="viewing = p">보기</button>
          <template v-if="!readonly">
            <button type="button" class="secondary small" @click="editing = p">수정</button>
            <button v-if="!p.isMain" type="button" class="secondary small" :disabled="busy" @click="makeMain(p)">대표로</button>
            <button v-if="!p.isMain" type="button" class="danger small" :disabled="busy" @click="remove(p)">삭제</button>
          </template>
        </div>
      </li>
    </ul>
    <p v-if="error" class="error">{{ error }}</p>

    <ProfileFormModal v-if="editing !== undefined" :character="character" :definitions="definitions" :profile="editing"
      @saved="onSaved" @close="editing = undefined" />

    <ModalDialog v-if="viewing" :title="label(viewing)" @close="viewing = null">
      <ProfileView :profile="viewing" />
    </ModalDialog>
  </section>
</template>
