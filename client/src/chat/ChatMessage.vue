<script setup>
// 메시지 한 줄 — 종류(type)별 화면이 있으면 그걸로(messageTypes.js), 없으면 본문 글자
import { computed } from 'vue';
import { messageComponent } from './messageTypes';

const props = defineProps({
  message: { type: Object, required: true },
  canDelete: { type: Boolean, default: false },
});
defineEmits(['delete']);

const custom = computed(() => (props.message.deleted ? null : messageComponent(props.message.type)));
const time = computed(() => new Date(props.message.createdAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }));
const fullTime = computed(() => new Date(props.message.createdAt).toLocaleString('ko-KR'));
</script>

<template>
  <!-- 시스템 메시지 (입장 안내, 모듈 알림 등) -->
  <li v-if="message.type === 'system'" class="chat-msg system">{{ message.body }}</li>
  <li v-else class="chat-msg" :class="{ deleted: message.deleted }">
    <div class="chat-msg-head">
      <strong class="chat-author">{{ message.author || '알 수 없음' }}</strong>
      <span v-if="message.authorRole === 'admin'" class="badge admin">관리자</span>
      <time class="muted" :title="fullTime">{{ time }}</time>
      <button v-if="canDelete && !message.deleted" type="button" class="link chat-del" title="메시지 삭제" @click="$emit('delete', message)">삭제</button>
    </div>
    <p v-if="message.deleted" class="chat-body muted">삭제된 메시지입니다.</p>
    <component :is="custom" v-else-if="custom" :message="message" />
    <p v-else class="chat-body">{{ message.body }}</p>
  </li>
</template>
