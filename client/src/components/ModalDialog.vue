<script setup>
// 팝업 창: <ModalDialog v-if="open" title="..." @close="open = false"> 내용 </ModalDialog>
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
          <button type="button" class="link" aria-label="닫기" @click="emit('close')">✕</button>
        </header>
        <slot />
      </div>
    </div>
  </Teleport>
</template>
