<script setup>
// 캐릭터(프로필) 페이지 /members/:id — 기본정보 + 캐릭터 스탯 + 프로필
// 처음엔 대표 프로필, 위쪽 목록에서 다른 프로필을 고르면 그 프로필과 음악으로 바뀜 (주소 ?profile=<번호> 로 바로 열기 가능)
// 내 캐릭터면 보고 있는 프로필을 그 자리에서 팝업 폼으로 수정
import { ref, computed, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api } from '../../api';
import { auth, isAdmin } from '../../auth';
import { site } from '../../site';
import { fetchAttributes } from '../../character';
import CharacterCard from '../../components/CharacterCard.vue';
import ProfileSection from '../../components/ProfileSection.vue';
import ProfileFormModal from '../../components/ProfileFormModal.vue';

const route = useRoute();
const router = useRouter();
const character = ref(null);
const error = ref('');
const isMine = ref(false);
const isApplicant = ref(false);   // 신청자의 신청서 (관리자만 볼 수 있음)
const definitions = ref(null);
const editing = ref(null);         // 수정 중인 프로필

// 주소의 ?profile= 과 보고 있는 프로필을 연결 (대표 프로필이면 주소에서 뺌)
const selectedId = computed({
  get: () => (route.query.profile ? Number(route.query.profile) : null),
  set: (id) => {
    const main = character.value?.profiles.find((p) => p.isMain);
    const query = { ...route.query };
    if (!id || id === main?.id) delete query.profile; else query.profile = String(id);
    router.replace({ query });
  },
});

async function load({ keep = false } = {}) {
  error.value = '';
  if (!keep) character.value = null;
  try {
    const data = await api(`/members/${route.params.id}`);
    character.value = data.character;
    isApplicant.value = !!data.applicant;
    isMine.value = false;
    if (auth.user) {
      const mine = (await api('/characters/me')).character;
      isMine.value = mine?.id === character.value.id;
    }
  } catch (e) {
    error.value = e.message;
  }
}

async function startEdit(profile) {
  if (!definitions.value) definitions.value = await fetchAttributes();
  editing.value = profile;
}

async function onSaved() {
  editing.value = null;
  await load({ keep: true });
}

watch(() => route.params.id, () => load(), { immediate: true });
</script>

<template>
  <section class="card">
    <div class="card-head">
      <RouterLink to="/members" class="muted">← 멤버 목록</RouterLink>
      <RouterLink v-if="isMine" to="/mypage" class="button secondary">마이페이지</RouterLink>
    </div>
    <p v-if="error" class="error">{{ error }}</p>
    <p v-else-if="!character" class="muted">불러오는 중…</p>
    <template v-else>
      <p v-if="isApplicant" class="applicant-note">
        <span class="badge applicant">신청자</span>
        아직 멤버가 아닌 신청자의 신청서입니다. 관리자만 볼 수 있습니다.
        <RouterLink to="/admin/applicants">신청자 관리로</RouterLink>
      </p>
      <h1>{{ character.name }}</h1>
      <CharacterCard :character="character" />
    </template>
  </section>

  <ProfileSection v-if="character" :key="character.id" v-model:selected="selectedId" :character="character">
    <template #actions="{ profile }">
      <button v-if="isMine && profile && (site.profileEditOpen || isAdmin())" type="button" class="secondary" @click="startEdit(profile)">이 프로필 수정</button>
    </template>
  </ProfileSection>

  <ProfileFormModal v-if="editing && definitions" :character="character" :definitions="definitions" :profile="editing"
    @saved="onSaved" @close="editing = null" />
</template>
