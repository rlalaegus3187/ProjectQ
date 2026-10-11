<script setup>
// 채팅 (/chat?room=<번호>) — 왼쪽 방 목록(내 방 · 다른 방 · 방 만들기) · 가운데 대화 · 오른쪽 가입자(접속 중 표시)
// 방은 가입해야 대화 가능, [나가기] — 마지막 사람이 나가면 방 폭파. 방장·관리자는 [삭제]
// 기록은 최신 20개만 받고, 위로 스크롤해 맨 위에 닿으면 이전 20개씩 (room:history)
// 표정(두상): 입력칸 옆에서 골라 보내면 그 표정 이미지가 메시지 옆에 (마이페이지 → 프로필 수정 → 채팅용 두상, 대표 프로필의 것), 내 메시지는 [수정]으로 내용·표정 고치기
// 글 꾸미기: 사이트 공통 마크다운 툴바·문법 (markdown/MarkdownToolbar.vue — 링크·이미지 넣기 포함)
// 소켓은 이 화면에 있는 동안만 연결 (client/src/chat/socket.js — 공간 'chat'), 메시지 종류별 화면은 client/src/chat/modules/
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api } from '../../api';
import { auth, isAdmin } from '../../auth';
import { getChatSocket, request } from '../../chat/socket';
import ChatMessage from '../../chat/ChatMessage.vue';
import FacePicker from '../../chat/FacePicker.vue';
import { MarkdownToolbar } from '../../markdown';
import ModalDialog from '../../components/ModalDialog.vue';

const route = useRoute();
const router = useRouter();
const socket = getChatSocket();

const rooms = ref([]);
const room = ref(null);          // 들어와 있는 방
const messages = ref([]);
const users = ref([]);           // 지금 이 방을 보고 있는 사람
const members = ref([]);         // 가입자
const commands = ref([]);
const text = ref('');
const error = ref('');          // 화면 전체 (접속 불가 등)
const sendError = ref('');      // 보내기·가입 등 실패
const notice = ref('');         // 방이 사라짐 등 안내
const status = ref('connecting');   // connecting / online / offline
const hasMore = ref(false);
const loadingMore = ref(false);
const typing = ref({});          // userId → { name, until }
const scroller = ref(null);
const creating = ref(null);      // { name, description, error, saving }
const input = ref(null);         // 입력칸 <textarea>
const faces = ref([]);           // 내 표정 목록
const faceId = ref(null);        // 지금 고른 표정 (브라우저에 기억)
const editing = ref(null);       // 메시지 고치기 { message, text, faceId, error, saving }
const editInput = ref(null);
const busy = ref(false);
let localId = 0;

const roomId = computed(() => (route.query.room ? Number(route.query.room) : null));
const selected = computed(() => rooms.value.find((r) => r.id === roomId.value) || null);   // 고른 방 (가입 안 했을 수도)
const myRooms = computed(() => rooms.value.filter((r) => r.joined));
const otherRooms = computed(() => rooms.value.filter((r) => !r.joined));
const onlineIds = computed(() => new Set(users.value.map((u) => u.id)));
const typingNames = computed(() => Object.values(typing.value).map((t) => t.name));
const canDeleteRoom = (r) => !!r && (isAdmin() || (!r.isPermanent && r.ownerId === auth.user?.id));
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
// 맨 위 근처에 닿으면 이전 기록
function onScroll() {
  if (scroller.value && scroller.value.scrollTop < 60) loadMore();
}
// 기록이 짧아 스크롤이 안 생기면 위로 올릴 수 없으므로 화면이 찰 때까지 더 불러옴
async function fillScreen() {
  await nextTick();
  const el = scroller.value;
  if (el && hasMore.value && el.scrollHeight <= el.clientHeight + 10) await loadMore();
}

// ---------- 방 목록 ----------
async function loadRooms() {
  const data = await api('/chat/rooms');
  if (!data.canChat) throw new Error('멤버만 채팅을 이용할 수 있습니다.');
  if (!data.enabled && !isAdmin()) throw new Error('지금은 채팅을 이용할 수 없습니다.');
  rooms.value = data.rooms;
}
const pick = (id) => { notice.value = ''; selectRoom(id); };   // 목록에서 직접 고름 → 안내 지움
function selectRoom(id) {
  if (id !== roomId.value) router.replace({ query: id ? { room: id } : {} });
}
function resetRoom() {
  room.value = null;
  messages.value = [];
  users.value = [];
  members.value = [];
  hasMore.value = false;
  typing.value = {};
}

// 들어가기 (가입한 방만) — 최신 20개
async function enter(id) {
  sendError.value = '';
  const r = rooms.value.find((x) => x.id === id);
  if (!id || !r?.joined) { resetRoom(); return; }
  try {
    const data = await request('room:enter', { roomId: id });
    room.value = data.room;
    messages.value = data.messages;
    hasMore.value = data.hasMore;
    users.value = data.users;
    members.value = data.members;
    commands.value = data.commands;
    typing.value = {};
    await toBottom();
    await fillScreen();
  } catch (e) {
    resetRoom();
    sendError.value = e.message;
  }
}

async function loadMore() {
  if (!room.value || !hasMore.value || !messages.value.length || loadingMore.value) return;
  loadingMore.value = true;
  const id = room.value.id;
  try {
    const el = scroller.value;
    const before = el.scrollHeight;
    const data = await request('room:history', { roomId: id, beforeId: messages.value.find((m) => m.id > 0)?.id });
    if (room.value?.id !== id) return;
    messages.value = [...data.messages, ...messages.value];
    hasMore.value = data.hasMore;
    await nextTick();
    el.scrollTop += el.scrollHeight - before;   // 보던 위치 그대로
  } catch (e) {
    sendError.value = e.message;
  } finally {
    loadingMore.value = false;
  }
  await fillScreen();
}

// ---------- 방 만들기 · 가입 · 나가기 · 삭제 ----------
function openCreate() {
  creating.value = { name: '', description: '', error: '', saving: false };
}
async function create() {
  const c = creating.value;
  c.error = '';
  c.saving = true;
  try {
    const { room: r } = await request('room:create', { name: c.name, description: c.description });
    await loadRooms();
    creating.value = null;
    selectRoom(r.id);
  } catch (e) {
    c.error = e.message;
  } finally {
    c.saving = false;
  }
}
async function act(fn) {
  if (busy.value) return;
  busy.value = true;
  sendError.value = '';
  try { await fn(); } catch (e) { sendError.value = e.message; } finally { busy.value = false; }
}
const join = (r) => act(async () => {
  await request('room:join', { roomId: r.id });
  await loadRooms();
  if (r.id === roomId.value) await enter(r.id);
  else selectRoom(r.id);
});
const leave = (r) => act(async () => {
  const last = r.memberCount <= 1 && !r.isPermanent;
  if (!confirm(last ? `'${r.name}' 방에서 나갈까요?\n마지막 사람이라 방이 폭파되고 대화 기록도 모두 사라집니다.` : `'${r.name}' 방에서 나갈까요?`)) return;
  const { destroyed } = await request('room:leave', { roomId: r.id });
  await loadRooms();
  notice.value = destroyed ? `'${r.name}' 방은 모두 나가서 사라졌습니다.` : `'${r.name}' 방에서 나왔습니다.`;
  if (destroyed) selectRoom(null);
  else resetRoom();
});
const removeRoom = (r) => act(async () => {
  if (!confirm(`'${r.name}' 방을 삭제할까요?\n대화 기록도 함께 사라지며 되돌릴 수 없습니다.`)) return;
  await request('room:delete', { roomId: r.id });
  await loadRooms();
  selectRoom(null);
});

// ---------- 표정 ----------
const FACE_KEY = () => `pq-chat-face-${auth.user?.id}`;
async function loadFaces() {
  faces.value = (await api('/characters/me/faces').catch(() => ({ faces: [] }))).faces;
  let saved = null;
  try { saved = Number(localStorage.getItem(FACE_KEY())) || null; } catch { /* 기억 못 해도 동작 */ }
  faceId.value = faces.value.some((f) => f.id === saved) ? saved : null;
}
watch(faceId, (id) => {
  try { localStorage.setItem(FACE_KEY(), id ? String(id) : ''); } catch { /* 기억 못 해도 동작 */ }
});

// ---------- 메시지 고치기 ----------
const canEdit = (m) => m.type === 'text' && !!m.userId && m.userId === auth.user?.id;
function startEdit(m) {
  editing.value = { message: m, text: m.body || '', faceId: m.face && faces.value.some((f) => f.id === m.face.id) ? m.face.id : null, error: '', saving: false };
}
async function saveEdit() {
  const e = editing.value;
  e.error = '';
  e.saving = true;
  try {
    await request('message:edit', { messageId: e.message.id, text: e.text, faceId: e.faceId });
    editing.value = null;
  } catch (err) {
    e.error = err.message;
  } finally {
    e.saving = false;
  }
}

// ---------- 보내기 ----------
async function send() {
  const body = text.value.trim();
  if (!body || !room.value) return;
  sendError.value = '';
  text.value = '';
  try {
    await request('message:send', { roomId: room.value.id, text: body, faceId: faceId.value });
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
  connect: () => { status.value = 'online'; error.value = ''; enter(roomId.value); },   // 재연결 때도 다시 입장
  disconnect: () => { status.value = 'offline'; },
  connect_error: (err) => { status.value = 'offline'; error.value = err.message || '채팅 서버에 연결할 수 없습니다.'; },
  'message:new': async (m) => {
    if (m.roomId !== room.value?.id) return;
    const stick = nearBottom() || m.userId === auth.user?.id;
    messages.value.push(m);
    delete typing.value[m.userId];
    if (stick) await toBottom();
  },
  'message:updated': (m) => {   // 누가 메시지·표정을 고침
    const i = messages.value.findIndex((x) => x.id === m.id);
    if (i >= 0) messages.value.splice(i, 1, m);
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
  'room:members': ({ roomId: id, members: list }) => { if (id === room.value?.id) members.value = list; },
  // 방이 사라졌거나(폭파·삭제·닫힘) 다른 창에서 나감 → 방에서 나옴
  'room:closed': async ({ roomId: id, reason }) => {
    if (id !== room.value?.id) return;
    resetRoom();
    notice.value = reason;
    await loadRooms().catch(() => {});
    if (!rooms.value.some((r) => r.id === id)) selectRoom(null);
  },
  typing: ({ roomId: id, userId, name }) => {
    if (id !== room.value?.id) return;
    typing.value = { ...typing.value, [userId]: { name, until: Date.now() + 4000 } };
  },
  'rooms:changed': async () => {
    await loadRooms().catch(() => {});
    if (roomId.value && !rooms.value.some((r) => r.id === roomId.value)) selectRoom(null);
  },
};
// 입력 중 표시는 4초 지나면 지움
const typingTimer = setInterval(() => {
  const now = Date.now();
  const left = Object.fromEntries(Object.entries(typing.value).filter(([, t]) => t.until > now));
  if (Object.keys(left).length !== Object.keys(typing.value).length) typing.value = left;
}, 1000);

watch(roomId, (id) => { if (status.value === 'online') enter(id); else resetRoom(); });

onMounted(async () => {
  try {
    await loadRooms();
  } catch (e) {
    error.value = e.message;
    status.value = 'offline';
    return;
  }
  await loadFaces();
  if (!roomId.value && myRooms.value[0]) router.replace({ query: { room: myRooms.value[0].id } });
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

    <div v-if="!error || rooms.length" class="chat-layout">
      <nav class="chat-rooms" aria-label="채팅방">
        <button type="button" class="chat-new" @click="openCreate">+ 방 만들기</button>
        <h3>내 방 <span class="muted">{{ myRooms.length }}</span></h3>
        <p v-if="!myRooms.length" class="muted chat-rooms-empty">가입한 방이 없습니다.</p>
        <button v-for="r in myRooms" :key="r.id" type="button" class="chat-room-btn" :class="{ active: r.id === roomId }" @click="pick(r.id)">
          <span class="chat-room-name"># {{ r.name }}<span v-if="r.adminOnly"> 🔒</span></span>
          <span class="muted chat-room-count">{{ r.memberCount }}명</span>
        </button>
        <h3>다른 방 <span class="muted">{{ otherRooms.length }}</span></h3>
        <p v-if="!otherRooms.length" class="muted chat-rooms-empty">더 가입할 방이 없습니다.</p>
        <button v-for="r in otherRooms" :key="r.id" type="button" class="chat-room-btn" :class="{ active: r.id === roomId }" @click="pick(r.id)">
          <span class="chat-room-name"># {{ r.name }}<span v-if="r.adminOnly"> 🔒</span></span>
          <span class="muted chat-room-count">{{ r.memberCount }}명</span>
        </button>
      </nav>

      <div class="chat-main">
        <header v-if="selected" class="chat-room-head">
          <div class="chat-room-title">
            <strong># {{ selected.name }}</strong>
            <span class="muted">
              {{ selected.isPermanent ? '상시 방' : `방장 ${selected.ownerName || '-'}` }} · 가입 {{ selected.memberCount }}명
            </span>
            <span v-if="selected.description" class="muted chat-room-desc">{{ selected.description }}</span>
          </div>
          <div class="chat-room-actions">
            <button v-if="!selected.joined" type="button" :disabled="busy" @click="join(selected)">가입</button>
            <button v-else type="button" class="secondary" :disabled="busy" @click="leave(selected)">나가기</button>
            <button v-if="canDeleteRoom(selected)" type="button" class="danger" :disabled="busy" @click="removeRoom(selected)">삭제</button>
          </div>
        </header>
        <p v-if="notice" class="ok chat-notice">{{ notice }}</p>

        <div v-if="room" ref="scroller" class="chat-messages" @scroll.passive="onScroll">
          <p v-if="loadingMore" class="muted chat-more">이전 대화 불러오는 중…</p>
          <p v-else-if="!hasMore && messages.length" class="muted chat-more">— 대화의 처음입니다 —</p>
          <p v-if="!messages.length" class="muted chat-empty">아직 대화가 없습니다. 첫 메시지를 보내보세요.</p>
          <ul class="chat-list">
            <ChatMessage v-for="m in messages" :key="m.id" :message="m" :can-delete="canDelete(m)" :can-edit="canEdit(m)" @delete="remove" @edit="startEdit" />
          </ul>
        </div>
        <div v-else class="chat-messages chat-placeholder">
          <p v-if="selected && !selected.joined" class="muted">가입하면 이 방의 대화를 보고 참여할 수 있습니다.</p>
          <p v-else-if="!selected" class="muted">왼쪽에서 방을 고르거나 새 방을 만들어보세요.</p>
        </div>

        <p class="chat-typing muted">{{ typingNames.length ? `${typingNames.join(', ')} 님이 입력 중…` : '' }}</p>
        <MarkdownToolbar v-if="room" v-model="text" :target="input" compact />
        <form class="chat-input" @submit.prevent="send">
          <FacePicker v-model="faceId" :faces="faces" />
          <textarea ref="input" v-model="text" rows="2" maxlength="1000" :disabled="!room || status !== 'online'"
            :placeholder="room ? (commands.length ? '메시지 입력 (Enter 보내기, Shift+Enter 줄바꿈, /도움말 명령어)' : '메시지 입력') : '가입한 방에 들어가면 대화할 수 있습니다'"
            aria-label="메시지" @keydown="onKey" @input="onInput" />
          <button type="submit" :disabled="!room || status !== 'online' || !text.trim()">보내기</button>
        </form>
        <p v-if="sendError" class="error">{{ sendError }}</p>
      </div>

      <aside class="chat-users" aria-label="가입자">
        <h3>가입자 <span class="muted">{{ members.length }}</span></h3>
        <ul>
          <li v-for="u in members" :key="u.id" :class="{ offline: !onlineIds.has(u.id) }">
            <span class="chat-online-dot" :title="onlineIds.has(u.id) ? '보고 있음' : ''" />{{ u.name }}
            <span v-if="room && !room.isPermanent && u.id === room.ownerId" class="badge">방장</span>
            <span v-if="u.role === 'admin'" class="badge admin">관리자</span>
          </li>
        </ul>
      </aside>
    </div>
  </section>

  <ModalDialog v-if="creating" title="방 만들기" @close="creating = null">
    <template #actions>
      <button type="submit" form="chat-create-form" :disabled="creating.saving">{{ creating.saving ? '만드는 중…' : '만들기' }}</button>
      <button type="button" class="secondary" @click="creating = null">취소</button>
    </template>
    <form id="chat-create-form" class="form" @submit.prevent="create">
      <div class="field">
        <label for="chat-room-name">방 이름<span class="req">*</span></label>
        <input id="chat-room-name" v-model="creating.name" required maxlength="50" placeholder="예: 오늘의 잡담" />
      </div>
      <div class="field">
        <label for="chat-room-desc">설명 <span class="muted">(선택)</span></label>
        <input id="chat-room-desc" v-model="creating.description" maxlength="255" />
      </div>
      <p class="muted">만든 사람이 방장이 되고 바로 가입됩니다. 모두 나가면 방은 사라집니다(대화 기록도 함께).</p>
      <p v-if="creating.error" class="error">{{ creating.error }}</p>
    </form>
  </ModalDialog>

  <ModalDialog v-if="editing" title="메시지 고치기" @close="editing = null">
    <template #actions>
      <button type="submit" form="chat-edit-form" :disabled="editing.saving || !editing.text.trim()">{{ editing.saving ? '저장 중…' : '저장' }}</button>
      <button type="button" class="secondary" @click="editing = null">취소</button>
    </template>
    <form id="chat-edit-form" class="form" @submit.prevent="saveEdit">
      <div class="field">
        <span>표정</span>
        <FacePicker v-model="editing.faceId" :faces="faces" inline />
      </div>
      <div class="field">
        <label for="chat-edit-text">내용</label>
        <MarkdownToolbar v-model="editing.text" :target="editInput" compact />
        <textarea id="chat-edit-text" ref="editInput" v-model="editing.text" rows="5" maxlength="1000" />
      </div>
      <p class="muted">고친 내용은 방에 있는 모두에게 바로 바뀌어 보이고, 메시지에 '(수정됨)'이 붙습니다.</p>
      <p v-if="editing.error" class="error">{{ editing.error }}</p>
    </form>
  </ModalDialog>
</template>
