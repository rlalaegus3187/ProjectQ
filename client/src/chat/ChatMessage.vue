<script setup>
// 메시지 한 줄 — 왼쪽 두상(말할 때 고른 표정, 없으면 이름 첫 글자) + 이름·시간 + 본문
// 본문은 사이트 공통 마크다운(글·페이지와 같은 문법·모양 — 굵게·형광펜·작게·링크·이미지 …, markdown/), 종류(type)별 화면이 있으면 그걸로(messageTypes.js)
import { computed } from 'vue';
import { messageComponent } from './messageTypes';
import { MarkdownView } from '../markdown';

const props = defineProps({
  message: { type: Object, required: true },
  canDelete: { type: Boolean, default: false },
  canEdit: { type: Boolean, default: false },
});
defineEmits(['delete', 'edit']);

const custom = computed(() => (props.message.deleted ? null : messageComponent(props.message.type)));
const time = computed(() => new Date(props.message.createdAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }));
const fullTime = computed(() => new Date(props.message.createdAt).toLocaleString('ko-KR'));
const editedTime = computed(() => props.message.editedAt && `${new Date(props.message.editedAt).toLocaleString('ko-KR')}에 고침`);
const initial = computed(() => (props.message.author || '?').slice(0, 1));
</script>

<template>
  <!-- 시스템 메시지 (입장 안내, 모듈 알림 등) -->
  <li v-if="message.type === 'system'" class="chat-msg system">{{ message.body }}</li>
  <li v-else class="chat-msg" :class="{ deleted: message.deleted }">
    <div class="chat-face" :title="message.face ? `${message.face.name} (${message.face.code})` : ''">
      <img v-if="message.face" :src="message.face.image" :alt="message.face.name" referrerpolicy="no-referrer" loading="lazy" />
      <span v-else aria-hidden="true">{{ initial }}</span>
    </div>
    <div class="chat-msg-main">
      <div class="chat-msg-head">
        <strong class="chat-author">{{ message.author || '알 수 없음' }}</strong>
        <span v-if="message.face" class="muted chat-face-name">{{ message.face.name }}</span>
        <span v-if="message.authorRole === 'admin'" class="badge admin">관리자</span>
        <time class="muted" :title="fullTime">{{ time }}</time>
        <span v-if="message.editedAt && !message.deleted" class="muted chat-edited" :title="editedTime">(수정됨)</span>
        <span class="chat-tools">
          <button v-if="canEdit && !message.deleted" type="button" class="link" title="메시지·표정 고치기" @click="$emit('edit', message)">수정</button>
          <button v-if="canDelete && !message.deleted" type="button" class="link" title="메시지 삭제" @click="$emit('delete', message)">삭제</button>
        </span>
      </div>
      <p v-if="message.deleted" class="chat-body muted">삭제된 메시지입니다.</p>
      <component :is="custom" v-else-if="custom" :message="message" />
      <MarkdownView v-else class="chat-body chat-md" :source="message.body" />
    </div>
  </li>
</template>
