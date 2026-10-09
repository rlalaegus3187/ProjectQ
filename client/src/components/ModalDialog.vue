<script setup>
// 팝업 창: <ModalDialog v-if="open" title="..." @close="open = false"> 내용 </ModalDialog>
//
// 저장/취소 같은 버튼은 늘 우측 상단(머리글)에 — #actions 슬롯에 넣음. 머리글은 스크롤해도 위에 붙어 있음
//   <ModalDialog title="아이템 수정" @close="...">
//     <template #actions>
//       <button type="submit" form="item-form">저장</button>          ← form="폼 id" 로 아래 폼을 제출
//       <button type="button" class="secondary" @click="...">취소</button>
//     </template>
//     <form id="item-form" class="form" @submit.prevent="save"> ... </form>
//   </ModalDialog>
// #actions 가 없으면 머리글에 닫기(✕) 버튼
import { onMounted, onBeforeUnmount } from 'vue';

defineProps({
  title: { type: String, default: '' },
});
const emit = defineEmits(['close']);

const onKey = (e) => { if (e.key === 'Escape') emit('close'); };
onMounted(() => document.addEventListener('keydown', onKey));
onBeforeUnmount(() => document.removeEventListener('keydown', onKey));
</script>

<template>
  <Teleport to="body">
    <div class="modal-backdrop" @click.self="emit('close')">
      <div class="modal" role="dialog" aria-modal="true" :aria-label="title">
        <header class="modal-head">
          <h2>{{ title }}</h2>
          <div v-if="$slots.actions" class="modal-actions"><slot name="actions" /></div>
          <button v-else type="button" class="link modal-close" aria-label="닫기" @click="emit('close')">✕</button>
        </header>
        <slot />
      </div>
    </div>
  </Teleport>
</template>
