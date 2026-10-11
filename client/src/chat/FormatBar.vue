<script setup>
// 채팅 글자 꾸미기 버튼 — 고른 글자(없으면 커서 자리)를 마크다운으로 감쌈. 화면은 markdown/render.js 의 renderChat
//   <FormatBar v-model="text" :target="textareaRef" />
import { nextTick } from 'vue';

const props = defineProps({ target: { type: Object, default: null } });   // <textarea> 요소
const text = defineModel({ type: String, default: '' });

// wrap: 앞뒤로 감싸기 / line: 줄 앞에 붙이기
const TOOLS = [
  { label: 'B', title: '굵게 **글자**', wrap: ['**', '**'], cls: 'b' },
  { label: 'I', title: '기울임 *글자*', wrap: ['*', '*'], cls: 'i' },
  { label: 'S', title: '취소선 ~~글자~~', wrap: ['~~', '~~'], cls: 's' },
  { label: '형광', title: '형광펜 ==글자==', wrap: ['==', '=='] },
  { label: '크게', title: '크게 (줄 앞에 # )', line: '# ' },
  { label: '조금 크게', title: '조금 크게 (줄 앞에 ## )', line: '## ' },
  { label: '작게', title: '작게 (줄 앞에 -# )', line: '-# ' },
  { label: '코드', title: '코드 `글자`', wrap: ['`', '`'] },
];

async function apply(t) {
  const el = props.target;
  const v = text.value;
  const start = el ? el.selectionStart : v.length;
  const end = el ? el.selectionEnd : v.length;
  let next;
  let selStart;
  let selEnd;
  if (t.wrap) {
    const inner = v.slice(start, end) || '글자';
    next = v.slice(0, start) + t.wrap[0] + inner + t.wrap[1] + v.slice(end);
    selStart = start + t.wrap[0].length;
    selEnd = selStart + inner.length;
  } else {
    const lineStart = v.lastIndexOf('\n', start - 1) + 1;
    const rest = v.slice(lineStart).replace(/^(#{1,3}|-#) /, '');   // 이미 붙은 크기 표시는 바꿈
    next = v.slice(0, lineStart) + t.line + rest;
    selStart = selEnd = Math.max(lineStart + t.line.length, start + (next.length - v.length));
  }
  text.value = next;
  await nextTick();
  if (el) {
    el.focus();
    el.setSelectionRange(selStart, selEnd);
  }
}
</script>

<template>
  <div class="chat-format" role="toolbar" aria-label="글자 꾸미기">
    <button v-for="t in TOOLS" :key="t.label" type="button" :class="t.cls" :title="t.title" @mousedown.prevent @click="apply(t)">{{ t.label }}</button>
  </div>
</template>
