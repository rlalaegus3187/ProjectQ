<script setup>
// 프로필 추가 / 수정 팝업 (모든 입력 폼과 같은 모양: 팝업 + 칸 묶음 + 아래 버튼)
//   <ProfileFormModal :character="c" :definitions="defs" :profile="p 또는 null(새 프로필)" @saved="(c) => ..." @close="..." />
// 저장하면 서버가 돌려준 최신 캐릭터를 saved 로 보냄 (새 프로필이면 newProfileId 도 함께)
import { ref, computed } from 'vue';
import { api } from '../api';
import { isSubmittedApplication, RESUBMIT_NOTICE } from '../auth';
import { toProfileForm } from '../character';
import ModalDialog from './ModalDialog.vue';
import ProfileFields from './ProfileFields.vue';

const props = defineProps({
  character: { type: Object, required: true },
  definitions: { type: Object, required: true },
  profile: { type: Object, default: null },   // null 이면 새 프로필
});
const emit = defineEmits(['saved', 'close']);

const form = ref(toProfileForm(props.definitions, props.profile));
const busy = ref(false);
const error = ref('');

const isNew = computed(() => !props.profile);
const isMain = computed(() => !!props.profile?.isMain);
const title = computed(() => {
  if (isNew.value) return '새 프로필';
  return isMain.value ? `대표 프로필 수정 — ${props.character.name}` : `프로필 수정 — ${props.profile.name}`;
});

async function save() {
  error.value = '';
  busy.value = true;
  try {
    const { character } = isNew.value
      ? await api('/characters/me/profiles', { method: 'POST', body: form.value })
      : await api(`/characters/me/profiles/${props.profile.id}`, { method: 'PUT', body: form.value });
    const newProfileId = isNew.value ? Math.max(...character.profiles.map((p) => p.id)) : props.profile.id;
    emit('saved', character, newProfileId);
  } catch (e) {
    error.value = e.message;
  } finally {
    busy.value = false;
  }
}

function close() {
  if (confirm('저장하지 않고 닫을까요?')) emit('close');
}
</script>

<template>
  <ModalDialog :title="title" @close="close">
    <form class="form" @submit.prevent="save">
      <p v-if="isSubmittedApplication(character)" class="applicant-note">{{ RESUBMIT_NOTICE }}</p>
      <ProfileFields v-model:name="form.name" v-model:details="form.details" v-model:music="form.music"
        :definitions="definitions" :legend="isMain ? '대표 프로필 (캐릭터 이름으로 표시)' : '프로필'" :show-name="!isMain" />
      <p v-if="error" class="error">{{ error }}</p>
      <div class="actions">
        <button type="submit" :disabled="busy">{{ busy ? '저장 중…' : isNew ? '프로필 추가' : '저장' }}</button>
        <button type="button" class="secondary" @click="close">취소</button>
      </div>
    </form>
  </ModalDialog>
</template>
