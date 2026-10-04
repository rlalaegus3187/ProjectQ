<script setup>
// 마크다운 편집기: 툴바(제목·굵게·기울임·취소선·목록·인용·링크·이미지 넣기) + 입력칸
//   <MarkdownEditor v-model="text" :rows="10" :maxlength="10000" id="bio" />
import { ref, nextTick } from 'vue';
import { uploadImage } from '../upload';

const props = defineProps({
  id: { type: String, default: undefined },            // <label for> 연결용
  rows: { type: Number, default: 10 },
  maxlength: { type: Number, default: 50000 },
  placeholder: { type: String, default: '내용을 입력하세요. (마크다운: ## 제목, **굵게**, - 목록)' },
});
const text = defineModel({ type: String, default: '' });

const textarea = ref(null);
const uploading = ref(false);
const uploadError = ref('');

// 커서 위치에 텍스트 삽입 (선택한 글자가 있으면 before/after 로 감쌈)
// atEnd: 선택 영역을 감싸지 않고 그 뒤에 삽입 (이미지)
async function insert(before, after = '', placeholder = '', { atEnd = false } = {}) {
  const el = textarea.value;
  const body = text.value || '';
  const end = el ? el.selectionEnd : body.length;
  const start = atEnd ? end : (el ? el.selectionStart : body.length);
  const selected = body.slice(start, end) || placeholder;
  text.value = body.slice(0, start) + before + selected + after + body.slice(end);
  // 화면(textarea 값)이 갱신된 직후 커서/선택 위치를 지정 — 삽입한 글자(자리표시)를 선택해서 바로 덮어쓸 수 있게
  await nextTick();
  if (!el) return;
  el.focus();
  el.setSelectionRange(start + before.length, start + before.length + selected.length);
}

async function onImage(event) {
  const file = event.target.files?.[0];
  event.target.value = '';
  if (!file) return;
  uploadError.value = '';
  uploading.value = true;
  try {
    const url = await uploadImage(file);
    await insert(`\n![${file.name.replace(/[[\]]/g, '')}](${url})\n`, '', '', { atEnd: true });
  } catch (e) {
    uploadError.value = e.message;
  } finally {
    uploading.value = false;
  }
}
</script>

<template>
  <div class="markdown-editor">
    <div class="toolbar">
      <button type="button" title="제목" @click="insert('\n## ', '', '소제목')">H</button>
      <button type="button" title="굵게" @click="insert('**', '**', '굵은 글씨')"><b>B</b></button>
      <button type="button" title="기울임" @click="insert('*', '*', '기울임')"><i>I</i></button>
      <button type="button" title="취소선" @click="insert('~~', '~~', '취소선')"><s>S</s></button>
      <span class="toolbar-sep" />
      <button type="button" title="목록" @click="insert('\n- ', '', '항목')">• 목록</button>
      <button type="button" title="인용" @click="insert('\n> ', '', '인용')">❝ 인용</button>
      <button type="button" title="링크" @click="insert('[', '](https://)', '링크 글자')">링크</button>
      <label class="toolbar-file" :class="{ disabled: uploading }">
        {{ uploading ? '업로드 중…' : '이미지 넣기' }}
        <input type="file" accept="image/png,image/jpeg,image/gif,image/webp" :disabled="uploading" @change="onImage" />
      </label>
    </div>

    <textarea :id="props.id" ref="textarea" v-model="text" :rows="props.rows"
      :maxlength="props.maxlength" :placeholder="props.placeholder" />
    <p v-if="uploadError" class="error">{{ uploadError }}</p>
  </div>
</template>
