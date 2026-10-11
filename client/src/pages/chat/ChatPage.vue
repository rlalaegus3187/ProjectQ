<script setup>
// 채팅 (/chat?room=<번호>) — 왼쪽 방 목록 · 가운데 대화 · 오른쪽 접속자
// 소켓은 이 화면에 있는 동안만 연결 (client/src/chat/socket.js), 메시지 종류별 화면은 client/src/chat/modules/
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api } from '../../api';
import { auth, isAdmin } from '../../auth';
import { getChatSocket, request } from '../../chat/socket';
import ChatMessage from '../../chat/ChatMessage.vue';

const route = useRoute();
const router = useRouter();
const socket = getChatSocket();

const rooms = ref([]);
const room = ref(null);
const messages = ref([]);
const users = ref([]);
const commands = ref([]);
const text = ref('');
const error = ref('');          // 화면 전체 (접속 불가 등)
const sendError = ref('');      // 보내기 실패
const status = ref('connecting');   // connecting / online / offline
const hasMore = ref(true);
const loadingMore = ref(false);
const typing = ref({});          // userId → { name, until }
const scroller = ref(null);
let localId = 0;

const roomId = computed(() => (route.query.room ? Number(route.query.room) : null));
const typingNames = computed(() => Object.values(typing.value).map((t) => t.name));
const STATUS_LABEL = { connecting: '연결 중…', online: '연결됨', offline: '연결 끊김 — 다시 연결하는 중' };

// ---------- 스크롤 ----------
const nearBottom = () => {
  const el = scroller.value;
  return !el || el.scrollHeight - el.scrollTop - el.clientHeight < 80;
};
async function toBottom() {
  await nextTick();
  if (scroller.value) scroller.value.scrollTop = scroller.value.scrollHeight;
}

// ---------- 방 ----------
async function loadRooms() {
  const data = await api('/chat/rooms');
  if (!data.canChat) throw new Error('멤버만 채팅을 이용할 수 있습니다.');
  if (!data.enabled && !isAdmin()) throw new Error('지금은 채팅을 이용할 수 없습니다.');
  rooms.value = data.rooms;
}

async function join(id) {
  if (!id) return;
  sendError.value = '';
  try {
    const data = await request('room:join', { roomId: id });
    room.value = data.room;
    messages.value = data.messages;
    users.value = data.users;
    commands.value = data.commands;
    hasMore.value = data.messages.length >= 50;
    typing.value = {};
    await toBottom();
  } catch (e) {
    room.value = null;
    error.value = e.message;
  }
}

function selectRoom(id) {
  if (id !== roomId.value) router.replace({ query: { ...route.query, room: id } });
}

async function loadMore() {
  if (!room.value || !messages.value.length || loadingMore.value) return;
  loadingMore.value = true;
  try {
    const el = scroller.value;
    const before = el.scrollHeight;
    const data = await request('room:history', { roomId: room.value.id, beforeId: messages.value[0].id });
    messages.value = [...data.messages, ...messages.value];
    hasMore.value = data.messages.length >= 50;
    await nextTick();
    el.scrollTop += el.scrollHeight - before;   // 보던 위치 그대로
  } catch (e) {
    sendError.value = e.message;
  } finally {
    loadingMore.value = false;
  }
}

// ---------- 보내기 ----------
async function send() {
  const body = text.value.trim();
  if (!body || !room.value) return;
  sendError.value = '';
  text.value = '';
  try {
    await request('message:send', { roomId: room.value.id, text: body });
  } catch (e) {
    sendError.value = e.message;
    if (!text.value) text.value = body;   // 실패하면 입력 내용 되돌림
  }
}
function onKey(e) {
  // Enter 보내기, Shift+Enter 줄바꿈 (한글 조합 중 Enter 는 무시)
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
    e.preventDefault();
    send();
  }
}
let lastTyping = 0;
function onInput() {
  if (!room.value || Date.now() - lastTyping < 2000) return;
  lastTyping = Date.now();
  socket.emit('typing', { roomId: room.value.id });
}

async function remove(m) {
  if (!confirm('이 메시지를 삭제할까요?')) return;
  try {
    await request('message:delete', { messageId: m.id });
  } catch (e) {
    sendError.value = e.message;
  }
}
const canDelete = (m) => !!m.userId && (isAdmin() || m.userId === auth.user?.id);

// ---------- 소켓 이벤트 ----------
const handlers = {
  connect: () => { status.value = 'online'; error.value = ''; if (roomId.value) join(roomId.value); },   // 재연결 때도 다시 입장
  disconnect: () => { status.value = 'offline'; },
  connect_error: (err) => { status.value = 'offline'; error.value = err.message || '채팅 서버에 연결할 수 없습니다.'; },
  'message:new': async (m) => {
    if (m.roomId !== room.value?.id) return;
    const stick = nearBottom() || m.userId === auth.user?.id;
    messages.value.push(m);
    delete typing.value[m.userId];
    if (stick) await toBottom();
  },
  'message:deleted': ({ id }) => {
    const m = messages.value.find((x) => x.id === id);
    if (m) Object.assign(m, { deleted: true, body: null, data: null });
  },
  'message:notice': async ({ text: t }) => {   // 나에게만 보이는 안내 (명령어 결과 등)
    localId -= 1;
    messages.value.push({ id: localId, type: 'system', body: t, createdAt: new Date().toISOString() });
    await toBottom();
  },
  'room:users': ({ roomId: id, users: list }) => { if (id === room.value?.id) users.value = list; },
  typing: ({ roomId: id, userId, name }) => {
    if (id !== room.value?.id) return;
    typing.value = { ...typing.value, [userId]: { name, until: Date.now() + 4000 } };
  },
  'rooms:changed': async () => {
    await loadRooms().catch(() => {});
    if (room.value && !rooms.value.some((r) => r.id === room.value.id)) {
      room.value = null;
      router.replace({ query: {} });
    }
  },
};
// 입력 중 표시는 4초 지나면 지움
const typingTimer = setInterval(() => {
  const now = Date.now();
  const left = Object.fromEntries(Object.entries(typing.value).filter(([, t]) => t.until > now));
  if (Object.keys(left).length !== Object.keys(typing.value).length) typing.value = left;
}, 1000);

watch(roomId, (id) => { if (status.value === 'online') join(id); });

onMounted(async () => {
  try {
    await loadRooms();
  } catch (e) {
    error.value = e.message;
    status.value = 'offline';
    return;
  }
  if (!roomId.value && rooms.value[0]) router.replace({ query: { room: rooms.value[0].id } });
  for (const [event, fn] of Object.entries(handlers)) socket.on(event, fn);
  socket.connect();
});
onBeforeUnmount(() => {
  clearInterval(typingTimer);
  for (const [event, fn] of Object.entries(handlers)) socket.off(event, fn);
  socket.disconnect();
});
</script>

<template>
  <section class="card chat-page">
    <div class="card-head">
      <h1>채팅</h1>
      <span class="chat-status" :class="status">{{ STATUS_LABEL[status] }}</span>
    </div>
    <p v-if="error" class="error">{{ error }}</p>

    <div v-if="rooms.length" class="chat-layout">
      <nav class="chat-rooms" aria-label="채팅방">
        <button v-for="r in rooms" :key="r.id" type="button" :class="{ active: r.id === room?.id }" @click="selectRoom(r.id)">
          # {{ r.name }}<span v-if="r.adminOnly" class="muted"> 🔒</span>
        </button>
      </nav>

      <div class="chat-main">
        <header v-if="room" class="chat-room-head">
          <strong># {{ room.name }}</strong>
          <span v-if="room.description" class="muted">{{ room.description }}</span>
        </header>
        <div ref="scroller" class="chat-messages">
          <button v-if="room && hasMore && messages.length" type="button" class="link chat-more" :disabled="loadingMore" @click="loadMore">
            {{ loadingMore ? '불러오는 중…' : '이전 대화 더 보기' }}
          </button>
          <p v-if="room && !messages.length" class="muted chat-empty">아직 대화가 없습니다. 첫 메시지를 보내보세요.</p>
          <ul class="chat-list">
            <ChatMessage v-for="m in messages" :key="m.id" :message="m" :can-delete="canDelete(m)" @delete="remove" />
          </ul>
        </div>
        <p class="chat-typing muted">{{ typingNames.length ? `${typingNames.join(', ')} 님이 입력 중…` : '' }}</p>
        <form class="chat-input" @submit.prevent="send">
          <textarea v-model="text" rows="2" maxlength="1000" :disabled="!room || status !== 'online'"
            :placeholder="commands.length ? '메시지 입력 (Enter 보내기, Shift+Enter 줄바꿈, /도움말 명령어)' : '메시지 입력'"
            aria-label="메시지" @keydown="onKey" @input="onInput" />
          <button type="submit" :disabled="!room || status !== 'online' || !text.trim()">보내기</button>
        </form>
        <p v-if="sendError" class="error">{{ sendError }}</p>
      </div>

      <aside class="chat-users" aria-label="접속 중">
        <h3>접속 중 <span class="muted">{{ users.length }}</span></h3>
        <ul>
          <li v-for="u in users" :key="u.id">
            <span class="chat-online-dot" />{{ u.name }}<span v-if="u.role === 'admin'" class="badge admin">관리자</span>
          </li>
        </ul>
      </aside>
    </div>
    <p v-else-if="!error" class="muted">들어갈 수 있는 채팅방이 없습니다.</p>
  </section>
</template>
