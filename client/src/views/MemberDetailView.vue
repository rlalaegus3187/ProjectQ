<script setup>
// 멤버란: 캐릭터 상세 (기본정보 + 캐릭터 스탯 + 프로필, 보기 전용)
import { ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { api } from '../api';
import { auth } from '../auth';
import CharacterCard from '../components/CharacterCard.vue';
import ProfileSection from '../components/ProfileSection.vue';

const route = useRoute();
const character = ref(null);
const error = ref('');
const isMine = ref(false);

async function load() {
  error.value = '';
  character.value = null;
  try {
    character.value = (await api(`/members/${route.params.id}`)).character;
    // 내 캐릭터면 마이페이지로 수정하러 갈 수 있게
    isMine.value = false;
    if (auth.user) {
      const mine = (await api('/characters/me')).character;
      isMine.value = mine?.id === character.value.id;
    }
  } catch (e) {
    error.value = e.message;
  }
}

watch(() => route.params.id, load, { immediate: true });
</script>

<template>
  <section class="card">
    <div class="card-head">
      <RouterLink to="/members" class="muted">← 멤버 목록</RouterLink>
      <RouterLink v-if="isMine" to="/mypage" class="button secondary">내 캐릭터 수정</RouterLink>
    </div>
    <p v-if="error" class="error">{{ error }}</p>
    <p v-else-if="!character" class="muted">불러오는 중…</p>
    <template v-else>
      <h1>{{ character.name }}</h1>
      <CharacterCard :character="character" />
    </template>
  </section>

  <ProfileSection v-if="character" :key="character.id" :character="character" readonly />
</template>
