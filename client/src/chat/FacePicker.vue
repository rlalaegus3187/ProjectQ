<script setup>
// 표정(두상) 고르기 — 대표 프로필의 채팅용 두상에서 하나 (마이페이지 → 프로필 수정 → 채팅용 두상에서 등록)
//   <FacePicker v-model="faceId" :faces="faces" />            입력칸 옆 버튼 → 누르면 목록이 펼쳐짐
//   <FacePicker v-model="faceId" :faces="faces" inline />     목록을 바로 펼쳐서 (메시지 고치기 창)
// faceId 가 null 이면 '표정 없음' (이름 첫 글자 두상)
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';

const props = defineProps({
  faces: { type: Array, default: () => [] },
  inline: { type: Boolean, default: false },
});
const faceId = defineModel({ type: Number, default: null });
const open = ref(false);
const root = ref(null);
const current = computed(() => props.faces.find((f) => f.id === faceId.value) || null);

function pick(id) {
  faceId.value = id;
  open.value = false;
}
const onDoc = (e) => { if (open.value && root.value && !root.value.contains(e.target)) open.value = false; };
onMounted(() => document.addEventListener('pointerdown', onDoc));
onBeforeUnmount(() => document.removeEventListener('pointerdown', onDoc));
</script>

<template>
  <div ref="root" class="face-picker" :class="{ inline }">
    <button v-if="!inline" type="button" class="face-current" :aria-expanded="String(open)" :title="current ? `표정: ${current.name}` : '표정 고르기'"
      @click="open = !open">
      <img v-if="current" :src="current.image" :alt="current.name" referrerpolicy="no-referrer" />
      <span v-else class="muted">표정</span>
    </button>
    <div v-if="inline || open" class="face-list" role="listbox" aria-label="표정">
      <button type="button" role="option" class="face-opt" :class="{ active: faceId === null }" :aria-selected="String(faceId === null)" @click="pick(null)">
        <span class="face-none">없음</span><span class="face-label">표정 없음</span>
      </button>
      <button v-for="f in faces" :key="f.id" type="button" role="option" class="face-opt" :class="{ active: f.id === faceId }"
        :aria-selected="String(f.id === faceId)" :title="f.code" @click="pick(f.id)">
        <img :src="f.image" :alt="f.name" referrerpolicy="no-referrer" loading="lazy" /><span class="face-label">{{ f.name }}</span>
      </button>
      <p v-if="!faces.length" class="muted face-empty">
        등록한 두상이 없습니다. <RouterLink to="/mypage">마이페이지</RouterLink> → 대표 프로필 [수정] → '채팅용 두상'에서 등록하세요.
      </p>
    </div>
  </div>
</template>
