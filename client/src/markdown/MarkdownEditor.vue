<script setup>
// 마크다운 편집기: 툴바(제목·굵게·기울임·목록·링크·이미지 + 글자색·형광펜·크기·정렬) + 미리보기
// 글자색/크기 등은 <span style="..."> 로 들어가고, 보여줄 때 허용된 값만 남김 (render.js)
//   <MarkdownEditor v-model="text" :rows="10" :maxlength="10000" id="bio" />
import { ref, nextTick } from 'vue';
import { uploadImage } from '../upload';
import MarkdownView from './MarkdownView.vue';

const props = defineProps({
  id: { type: String, default: undefined },            // <label for> 연결용
  rows: { type: Number, default: 10 },
  maxlength: { type: Number, default: 50000 },
  placeholder: { type: String, default: '내용을 입력하세요. (마크다운: ## 제목, **굵게**, - 목록)' },
});
const text = defineModel({ type: String, default: '' });

const tab = ref('write');
const menu = ref(null);   // 열린 팔레트: 'color' | 'bg' | 'size' | null

// 글자색 / 형광펜 / 크기 선택지
const COLORS = ['#111827', '#6b7280', '#dc2626', '#ea580c', '#ca8a04', '#16a34a', '#0891b2', '#2563eb', '#7c3aed', '#db2777'];
const HIGHLIGHTS = ['#fef08a', '#bbf7d0', '#bae6fd', '#fbcfe8', '#fed7aa', '#e5e7eb'];
const SIZES = [
  { value: '0.85em', label: '작게' },
  { value: '1.25em', label: '크게' },
  { value: '1.5em', label: '더 크게' },
  { value: '2em', label: '아주 크게' },
];

function styled(css) {
  menu.value = null;
  return insert(`<span style="${css}">`, '</span>', '글자');
}
const align = (value) => insert(`\n<div style="text-align: ${value}">\n\n`, '\n\n</div>\n', '내용');
const toggleMenu = (name) => { menu.value = menu.value === name ? null : name; };
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
    <div class="editor-tabs">
      <button type="button" :class="{ active: tab === 'write' }" @click="tab = 'write'">작성</button>
      <button type="button" :class="{ active: tab === 'preview' }" @click="tab = 'preview'">미리보기</button>
    </div>
    <div v-if="tab === 'write'" class="toolbar">
      <button type="button" title="제목" @click="insert('\n## ', '', '소제목')">H</button>
      <button type="button" title="굵게" @click="insert('**', '**', '굵은 글씨')"><b>B</b></button>
      <button type="button" title="기울임" @click="insert('*', '*', '기울임')"><i>I</i></button>
      <button type="button" title="취소선" @click="insert('~~', '~~', '취소선')"><s>S</s></button>
      <span class="toolbar-sep" />
      <div class="toolbar-menu">
        <button type="button" title="글자색" :class="{ active: menu === 'color' }" @click="toggleMenu('color')">
          <span class="swatch-a">A</span> 색
        </button>
        <div v-if="menu === 'color'" class="palette">
          <button v-for="c in COLORS" :key="c" type="button" class="swatch" :style="{ background: c }" :title="c" @click="styled(`color: ${c}`)" />
          <label class="swatch custom" title="직접 고르기">
            +<input type="color" @change="styled(`color: ${$event.target.value}`)" />
          </label>
        </div>
      </div>
      <div class="toolbar-menu">
        <button type="button" title="형광펜(배경색)" :class="{ active: menu === 'bg' }" @click="toggleMenu('bg')">
          <span class="swatch-hl">형광펜</span>
        </button>
        <div v-if="menu === 'bg'" class="palette">
          <button v-for="c in HIGHLIGHTS" :key="c" type="button" class="swatch" :style="{ background: c }" :title="c" @click="styled(`background-color: ${c}`)" />
          <label class="swatch custom" title="직접 고르기">
            +<input type="color" @change="styled(`background-color: ${$event.target.value}`)" />
          </label>
        </div>
      </div>
      <div class="toolbar-menu">
        <button type="button" title="글자 크기" :class="{ active: menu === 'size' }" @click="toggleMenu('size')">크기 ▾</button>
        <div v-if="menu === 'size'" class="palette sizes">
          <button v-for="sz in SIZES" :key="sz.value" type="button" :style="{ fontSize: sz.value }" @click="styled(`font-size: ${sz.value}`)">
            {{ sz.label }}
          </button>
        </div>
      </div>
      <button type="button" title="가운데 정렬" @click="align('center')">가운데</button>
      <button type="button" title="오른쪽 정렬" @click="align('right')">오른쪽</button>
      <span class="toolbar-sep" />
      <button type="button" title="목록" @click="insert('\n- ', '', '항목')">• 목록</button>
      <button type="button" title="인용" @click="insert('\n> ', '', '인용')">❝ 인용</button>
      <button type="button" title="링크" @click="insert('[', '](https://)', '링크 글자')">링크</button>
      <label class="toolbar-file" :class="{ disabled: uploading }">
        {{ uploading ? '업로드 중…' : '이미지 넣기' }}
        <input type="file" accept="image/png,image/jpeg,image/gif,image/webp" :disabled="uploading" @change="onImage" />
      </label>
    </div>

    <textarea v-show="tab === 'write'" :id="props.id" ref="textarea" v-model="text" :rows="props.rows"
      :maxlength="props.maxlength" :placeholder="props.placeholder" />
    <div v-if="tab === 'preview'" class="preview">
      <MarkdownView v-if="text" :source="text" />
      <p v-else class="muted">내용이 없습니다.</p>
    </div>
    <p v-if="uploadError" class="error">{{ uploadError }}</p>
  </div>
</template>
