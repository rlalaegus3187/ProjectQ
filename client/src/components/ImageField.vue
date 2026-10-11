<script setup>
// 이미지 입력 — 두 가지 방법: [파일 올리기] 파일을 골라 업로드 / [링크로 등록] 바깥 이미지 주소(http(s)://)를 붙여 넣기
// 어느 쪽이든 v-model 에는 이미지 주소 하나 (/api/uploads/... 또는 https://...) — 서버 검사는 server/src/images.js
//   <ImageField v-model="item.image" id="item-image" />
import { ref, watch } from 'vue';
import { uploadImage } from '../upload';

const props = defineProps({
  id: { type: String, default: undefined },
  alt: { type: String, default: '' },
  accept: { type: String, default: 'image/png,image/jpeg,image/gif,image/webp' },
  hint: { type: String, default: 'png, jpg, gif, webp · 5MB 이하' },
});
const value = defineModel({ type: String, default: '' });

const isLink = (v) => /^https?:\/\//i.test(v || '');
const mode = ref(isLink(value.value) ? 'link' : 'file');   // file / link
const linkText = ref(isLink(value.value) ? value.value : '');
const uploading = ref(false);
const error = ref('');
const broken = ref(false);   // 미리보기를 불러오지 못함 (링크가 잘못됐거나 그 사이트가 막음)

watch(value, (v) => { broken.value = false; if (isLink(v)) linkText.value = v; });

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

// 링크 적용: http(s):// 로 시작하는 주소만 (공백 없이)
function applyLink() {
  error.value = '';
  const url = linkText.value.trim();
  if (!url) { value.value = ''; return; }
  let ok = false;
  try { ok = /^https?:$/.test(new URL(url).protocol) && !/\s/.test(url); } catch { ok = false; }
  if (!ok) { error.value = 'http:// 또는 https:// 로 시작하는 이미지 주소를 넣어주세요.'; return; }
  if (url.length > 1000) { error.value = '주소가 너무 깁니다. (1,000자 이내)'; return; }
  value.value = url;
}
function clear() {
  value.value = '';
  linkText.value = '';
  error.value = '';
}
</script>

<template>
  <div class="image-field">
    <img v-if="value && !broken" :src="value" :alt="alt" class="thumb" referrerpolicy="no-referrer" @error="broken = true" />
    <p v-if="value && broken" class="error">이미지를 불러올 수 없습니다. 링크가 맞는지, 그 사이트가 바깥 사용을 막지 않는지 확인해주세요.</p>

    <div class="image-mode" role="tablist" aria-label="이미지 넣는 방법">
      <button type="button" role="tab" :aria-selected="mode === 'file'" :class="{ active: mode === 'file' }" @click="mode = 'file'">파일 올리기</button>
      <button type="button" role="tab" :aria-selected="mode === 'link'" :class="{ active: mode === 'link' }" @click="mode = 'link'">링크로 등록</button>
    </div>

    <div v-if="mode === 'file'" class="image-actions">
      <input :id="props.id" type="file" :accept="accept" :disabled="uploading" @change="onFile" />
      <button v-if="value" type="button" class="link" @click="clear">이미지 삭제</button>
    </div>
    <div v-else class="image-link">
      <input :id="props.id" v-model="linkText" type="url" maxlength="1000" placeholder="https://example.com/image.png"
        aria-label="이미지 링크" @keydown.enter.prevent="applyLink" @blur="linkText.trim() && linkText.trim() !== value && applyLink()" />
      <button type="button" class="secondary small" @click="applyLink">적용</button>
      <button v-if="value" type="button" class="link" @click="clear">이미지 삭제</button>
    </div>

    <span v-if="uploading" class="muted">업로드 중…</span>
    <span v-else-if="mode === 'file'" class="muted">{{ hint }}</span>
    <span v-else class="muted">이미지 주소를 붙여 넣고 [적용] — 원래 사이트에서 지우거나 막으면 여기서도 안 보입니다.</span>
    <span v-if="error" class="error">{{ error }}</span>
  </div>
</template>
