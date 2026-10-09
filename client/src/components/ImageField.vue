<script setup>
// 이미지 업로드 입력: 파일 선택 → 업로드 → 경로(/api/uploads/...)를 v-model 로
//   <ImageField v-model="item.image" id="item-image" />
import { ref } from 'vue';
import { uploadImage } from '../upload';

defineProps({
  id: { type: String, default: undefined },
  alt: { type: String, default: '' },
  accept: { type: String, default: 'image/png,image/jpeg,image/gif,image/webp' },
  hint: { type: String, default: 'png, jpg, gif, webp · 5MB 이하' },
});
const value = defineModel({ type: String, default: '' });

const uploading = ref(false);
const error = ref('');

async function onFile(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  error.value = '';
  uploading.value = true;
  try {
    value.value = await uploadImage(file);
  } catch (e) {
    error.value = e.message;
  } finally {
    uploading.value = false;
    event.target.value = '';
  }
}
</script>

<template>
  <div class="image-field">
    <img v-if="value" :src="value" :alt="alt" class="thumb" />
    <div class="image-actions">
      <input :id="id" type="file" :accept="accept" :disabled="uploading" @change="onFile" />
      <button v-if="value" type="button" class="link" @click="value = ''">이미지 삭제</button>
    </div>
    <span v-if="uploading" class="muted">업로드 중…</span>
    <span v-else class="muted">{{ hint }}</span>
    <span v-if="error" class="error">{{ error }}</span>
  </div>
</template>
