<script setup>
// 캐릭터 프로필 보기 (프로필 페이지 /members/:id, 신청자 보기 팝업)
// 처음엔 대표 프로필, 위쪽 목록에서 다른 프로필을 고르면 그 프로필로 바뀜 — 음악도 그 프로필 음악으로
//   <ProfileSection :character="c" v-model:selected="profileId" />    (selected 를 주소 ?profile= 과 연결 가능)
//   <template #actions="{ profile }"> 수정 버튼 등 </template>
import { computed } from 'vue';
import ProfileView from './ProfileView.vue';
import { usePageMusic } from '../music';

const props = defineProps({
  character: { type: Object, required: true },
  playMusic: { type: Boolean, default: true },   // 보고 있는 프로필의 음악 재생
});
const selectedId = defineModel('selected', { type: Number, default: null });

const profiles = computed(() => props.character.profiles);
// 고른 프로필이 없으면(처음, 없어진 프로필) 대표 프로필 = 맨 앞
const selected = computed(() => profiles.value.find((p) => p.id === selectedId.value) ?? profiles.value[0] ?? null);
// 대표 프로필은 이름 대신 캐릭터 이름으로 표시
const tabLabel = (p) => (p.isMain ? props.character.name : p.name);

// 보고 있는 프로필의 음악 재생 (음악이 없는 프로필이면 페이지/사이트 음악으로)
usePageMusic(() => (props.playMusic ? selected.value?.musicVideoId : null));
</script>

<template>
  <section class="card">
    <div class="card-head">
      <h2>프로필</h2>
      <slot name="actions" :profile="selected" />
    </div>

    <p v-if="!selected" class="muted">프로필이 없습니다.</p>
    <template v-else>
      <!-- 프로필이 여러 개면 위쪽 목록에서 고르기 -->
      <div v-if="profiles.length > 1" class="tabs profile-tabs" role="tablist" aria-label="프로필 목록">
        <button v-for="p in profiles" :key="p.id" type="button" role="tab" :aria-selected="p.id === selected.id"
          :class="{ active: p.id === selected.id }" @click="selectedId = p.id">
          <span v-if="p.isMain" class="badge pin">대표</span> {{ tabLabel(p) }}
          <span v-if="p.musicVideoId" class="tab-music" title="프로필 음악">♪</span>
        </button>
      </div>
      <ProfileView :key="selected.id" :profile="selected" />
    </template>
  </section>
</template>
