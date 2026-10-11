<script setup>
// 마크다운 툴바 (사이트 전체 공통 — 글·페이지·프로필 편집기(MarkdownEditor)와 채팅 입력칸이 같은 버튼·같은 문법)
//   <MarkdownToolbar v-model="text" :target="textareaRef" />
//   제목 · 굵게 · 기울임 · 취소선 · 형광펜 · 작게 | 목록 · 인용 · 코드 · 링크 · 이미지 넣기(파일) · 이미지 링크
// 표시(renderMarkdown, render.js)도 한 곳 — 어디서 써도 똑같이 보임
import { ref, nextTick } from 'vue';
import { uploadImage } from '../upload';

const props = defineProps({
  target: { type: Object, default: null },   // <textarea> 요소 (커서 위치에 넣기)
  compact: { type: Boolean, default: false }, // 작은 버튼 (채팅)
});
const text = defineModel({ type: String, default: '' });
const uploading = ref(false);
const error = ref('');

async function select(start, end) {
  await nextTick();
  const el = props.target;
  if (!el) return;
  el.focus();
  el.setSelectionRange(start, end);
}

// 선택한 글자를 앞뒤로 감쌈 (없으면 자리표시 글자를 넣고 선택)
function wrap(before, after, placeholder) {
  const el = props.target;
  const body = text.value || '';
  const start = el ? el.selectionStart : body.length;
  const end = el ? el.selectionEnd : body.length;
  const selected = body.slice(start, end) || placeholder;
  text.value = body.slice(0, start) + before + selected + after + body.slice(end);
  return select(start + before.length, start + before.length + selected.length);
}

// 줄 앞에 붙이기 (제목·목록·인용·작게) — 이미 붙어 있는 줄 머리표는 바꿈
function line(prefix, placeholder) {
  const el = props.target;
  const body = text.value || '';
  const pos = el ? el.selectionStart : body.length;
  const lineStart = body.lastIndexOf('\n', pos - 1) + 1;
  let lineEnd = body.indexOf('\n', pos);
  if (lineEnd < 0) lineEnd = body.length;
  const content = body.slice(lineStart, lineEnd).replace(/^(#{1,6} |-# |- |> )/, '') || placeholder;
  text.value = body.slice(0, lineStart) + prefix + content + body.slice(lineEnd);
  return select(lineStart + prefix.length, lineStart + prefix.length + content.length);
}

// 커서 뒤에 한 덩어리 넣기 (이미지) — 앞뒤로 줄을 띄움
function block(snippet) {
  const el = props.target;
  const body = text.value || '';
  const pos = el ? el.selectionEnd : body.length;
  const before = pos > 0 && body[pos - 1] !== '\n' ? '\n' : '';
  const after = pos < body.length && body[pos] !== '\n' ? '\n' : '';
  text.value = body.slice(0, pos) + before + snippet + after + body.slice(pos);
  const at = pos + before.length + snippet.length;
  return select(at, at);
}

function onLink() {
  error.value = '';
  const url = (window.prompt('링크 주소(https://...)를 넣으세요', 'https://') || '').trim();
  if (!url || url === 'https://') return undefined;
  if (!/^https?:\/\/\S+$/i.test(url) && !url.startsWith('/')) { error.value = 'http(s):// 로 시작하는 주소(또는 / 로 시작하는 사이트 안 주소)를 넣어주세요.'; return undefined; }
  return wrap('[', `](${url.replace(/[()]/g, encodeURIComponent)})`, '링크 글자');
}
function onImageLink() {
  error.value = '';
  const url = (window.prompt('이미지 주소(https://...)를 붙여 넣으세요') || '').trim();
  if (!url) return undefined;
  let ok = false;
  try { ok = /^https?:$/.test(new URL(url).protocol) && !/[\s()]/.test(url); } catch { ok = false; }
  if (!ok) { error.value = 'http:// 또는 https:// 로 시작하는 이미지 주소를 넣어주세요. (공백·괄호 없이)'; return undefined; }
  return block(`![이미지](${url})`);
}
async function onImage(event) {
  const file = event.target.files?.[0];
  event.target.value = '';
  if (!file) return;
  error.value = '';
  uploading.value = true;
  try {
    await block(`![${file.name.replace(/[[\]]/g, '')}](${await uploadImage(file)})`);
  } catch (e) {
    error.value = e.message;
  } finally {
    uploading.value = false;
  }
}
</script>

<template>
  <div class="toolbar" :class="{ compact }" role="toolbar" aria-label="글 꾸미기">
    <button type="button" title="제목 (## )" @mousedown.prevent @click="line('## ', '소제목')">H</button>
    <button type="button" title="굵게 **글자**" @mousedown.prevent @click="wrap('**', '**', '굵은 글씨')"><b>B</b></button>
    <button type="button" title="기울임 *글자*" @mousedown.prevent @click="wrap('*', '*', '기울임')"><i>I</i></button>
    <button type="button" title="취소선 ~~글자~~" @mousedown.prevent @click="wrap('~~', '~~', '취소선')"><s>S</s></button>
    <button type="button" title="형광펜 ==글자==" @mousedown.prevent @click="wrap('==', '==', '형광펜')"><mark>형광</mark></button>
    <button type="button" title="작게 (줄 앞에 -# )" @mousedown.prevent @click="line('-# ', '작은 글씨')"><small>작게</small></button>
    <span class="toolbar-sep" />
    <button type="button" title="목록 (- )" @mousedown.prevent @click="line('- ', '항목')">• 목록</button>
    <button type="button" title="인용 (> )" @mousedown.prevent @click="line('> ', '인용')">❝ 인용</button>
    <button type="button" title="코드 `글자`" @mousedown.prevent @click="wrap('`', '`', '코드')">코드</button>
    <button type="button" title="링크 [글자](주소)" @mousedown.prevent @click="onLink">링크</button>
    <label class="toolbar-file" :class="{ disabled: uploading }" title="이미지 파일 올려서 넣기">
      {{ uploading ? '업로드 중…' : '이미지 넣기' }}
      <input type="file" accept="image/png,image/jpeg,image/gif,image/webp" :disabled="uploading" @change="onImage" />
    </label>
    <button type="button" title="이미지 주소(링크)로 넣기" @mousedown.prevent @click="onImageLink">이미지 링크</button>
  </div>
  <p v-if="error" class="error">{{ error }}</p>
</template>
