<script setup>
// 게시글 등록툴: 제목 + 본문(마크다운) + 이미지 넣기 + 미리보기 (+ Q&A 비밀글)
import { ref, nextTick } from 'vue';
import { uploadImage } from '../character';
import MarkdownView from './MarkdownView.vue';

const props = defineProps({
  allowHidden: { type: Boolean, default: false },
  titleLabel: { type: String, default: '제목' },
  withTitle: { type: Boolean, default: true },
  rows: { type: Number, default: 14 },
});
const post = defineModel({ type: Object, required: true });   // { title, body, isHidden }

const tab = ref('write');
const textarea = ref(null);
const uploading = ref(false);
const uploadError = ref('');

// 커서 위치에 텍스트 삽입 (선택한 글자가 있으면 before/after 로 감쌈)
// atEnd: 선택 영역을 감싸지 않고 그 뒤에 삽입 (이미지)
async function insert(before, after = '', placeholder = '', { atEnd = false } = {}) {
  const el = textarea.value;
  const body = post.value.body || '';
  const end = el ? el.selectionEnd : body.length;
  const start = atEnd ? end : (el ? el.selectionStart : body.length);
  const selected = body.slice(start, end) || placeholder;
  post.value.body = body.slice(0, start) + before + selected + after + body.slice(end);
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
    insert(`\n![${file.name.replace(/[[\]]/g, '')}](${url})\n`, '', '', { atEnd: true });
  } catch (e) {
    uploadError.value = e.message;
  } finally {
    uploading.value = false;
  }
}
</script>

<template>
  <div class="post-editor">
    <label v-if="withTitle" class="field">
      {{ titleLabel }}
      <input v-model="post.title" required maxlength="200" />
    </label>

    <div class="editor-tabs">
      <button type="button" :class="{ active: tab === 'write' }" @click="tab = 'write'">작성</button>
      <button type="button" :class="{ active: tab === 'preview' }" @click="tab = 'preview'">미리보기</button>
      <div v-if="tab === 'write'" class="toolbar">
        <button type="button" title="제목" @click="insert('\n## ', '', '소제목')">H</button>
        <button type="button" title="굵게" @click="insert('**', '**', '굵은 글씨')"><b>B</b></button>
        <button type="button" title="기울임" @click="insert('*', '*', '기울임')"><i>I</i></button>
        <button type="button" title="목록" @click="insert('\n- ', '', '항목')">• 목록</button>
        <button type="button" title="링크" @click="insert('[', '](https://)', '링크 글자')">링크</button>
        <label class="toolbar-file" :class="{ disabled: uploading }">
          {{ uploading ? '업로드 중…' : '이미지 넣기' }}
          <input type="file" accept="image/png,image/jpeg,image/gif,image/webp" :disabled="uploading" @change="onImage" />
        </label>
      </div>
    </div>

    <textarea v-show="tab === 'write'" ref="textarea" v-model="post.body" :rows="props.rows" maxlength="50000"
      placeholder="내용을 입력하세요. (마크다운: ## 제목, **굵게**, - 목록)" />
    <div v-if="tab === 'preview'" class="preview">
      <MarkdownView v-if="post.body" :source="post.body" />
      <p v-else class="muted">내용이 없습니다.</p>
    </div>
    <p v-if="uploadError" class="error">{{ uploadError }}</p>

    <label v-if="allowHidden" class="inline">
      <input v-model="post.isHidden" type="checkbox" /> 비밀글 (작성자와 관리자만 볼 수 있음)
    </label>
  </div>
</template>
