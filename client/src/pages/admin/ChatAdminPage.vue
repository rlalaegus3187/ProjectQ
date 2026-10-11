<script setup>
// 관리자: 채팅 관리 — 채팅 켜기/끄기, 채팅방 추가·수정·삭제·기록 비우기, 연결 정보(포트·주소·모듈 — 읽기 전용)
// 상시 방: 여기서 만든 방(비어도 남음) / 회원 방: 회원이 채팅 화면에서 만든 방(모두 나가면 폭파)
import { ref, computed, onMounted } from 'vue';
import { api } from '../../api';
import { setSite } from '../../site';
import ModalDialog from '../../components/ModalDialog.vue';
import ToggleSwitch from '../../components/ToggleSwitch.vue';

const rooms = ref([]);
const info = ref(null);
const enabled = ref(true);
const error = ref('');
const message = ref('');
const editing = ref(null);   // { id?, name, description, isActive, adminOnly, sortOrder, error }
const saving = ref(false);

function flash(text) {
  message.value = text;
  setTimeout(() => { if (message.value === text) message.value = ''; }, 3000);
}
function apply(data) {
  rooms.value = data.rooms;
  info.value = data.info;
  enabled.value = data.enabled;
}
async function load() {
  apply(await api('/admin/chat'));
}

async function toggleChat(on) {
  error.value = '';
  try {
    setSite(await api('/admin/settings', { method: 'PUT', body: { chatEnabled: on } }));
    flash(on ? '채팅을 켰습니다.' : '채팅을 껐습니다. 관리자만 들어갈 수 있고, 상단 메뉴에서도 빠집니다.');
  } catch (e) {
    enabled.value = !on;
    error.value = e.message;
  }
}

function newRoom() {
  const maxOrder = Math.max(0, ...rooms.value.map((r) => r.sortOrder));
  editing.value = { name: '', description: '', isActive: true, adminOnly: false, isPermanent: true, sortOrder: maxOrder + 10, error: '' };
}
function editRoom(r) {
  editing.value = { ...r, error: '' };
}
async function save() {
  const { id, name, description, isActive, adminOnly, isPermanent, sortOrder } = editing.value;
  editing.value.error = '';
  saving.value = true;
  try {
    const body = { name, description, isActive, adminOnly, isPermanent, sortOrder };
    apply(id ? await api(`/admin/chat/rooms/${id}`, { method: 'PUT', body }) : await api('/admin/chat/rooms', { method: 'POST', body }));
    flash(`'${name}' 방을 ${id ? '수정' : '추가'}했습니다.`);
    editing.value = null;
  } catch (e) {
    editing.value.error = e.message;
  } finally {
    saving.value = false;
  }
}
async function remove(r) {
  if (!confirm(`'${r.name}' 방을 삭제할까요?\n대화 기록(${r.messageCount}개)도 함께 삭제되며 되돌릴 수 없습니다.\n(기록을 남기려면 삭제 대신 '사용'을 끄세요)`)) return;
  try {
    apply(await api(`/admin/chat/rooms/${r.id}`, { method: 'DELETE' }));
    flash(`'${r.name}' 방을 삭제했습니다.`);
  } catch (e) {
    error.value = e.message;
  }
}
async function clearMessages(r) {
  if (!confirm(`'${r.name}' 방의 대화 기록 ${r.messageCount}개를 모두 지울까요? 되돌릴 수 없습니다.`)) return;
  try {
    const { deleted } = await api(`/admin/chat/rooms/${r.id}/messages`, { method: 'DELETE' });
    await load();
    flash(`'${r.name}' 방의 기록 ${deleted}개를 지웠습니다.`);
  } catch (e) {
    error.value = e.message;
  }
}

const roleLabel = computed(() => (info.value?.roles || []).map((r) => ({ admin: '관리자', member: '멤버', applicant: '신청자' }[r] || r)).join(' · '));

onMounted(() => load().catch((e) => { error.value = e.message; }));
</script>

<template>
  <section class="card">
    <div class="card-head">
      <h1>채팅 관리</h1>
      <RouterLink to="/chat" class="button secondary">채팅 열기</RouterLink>
    </div>
    <div class="form">
      <label class="switch-row">
        <ToggleSwitch v-model="enabled" @change="toggleChat" />
        <span>
          채팅 <strong :class="enabled ? 'on' : 'off'">{{ enabled ? '사용' : '미사용' }}</strong>
          <span class="muted">— 끄면 관리자만 들어갈 수 있고 상단 메뉴의 '채팅'도 사라집니다. 방과 대화 기록은 그대로 남습니다.
            메뉴에서의 위치·표시는 <RouterLink to="/admin/menu">메뉴 관리</RouterLink>에서.</span>
        </span>
      </label>
    </div>
    <p v-if="error" class="error">{{ error }}</p>
    <p v-if="message" class="ok">{{ message }}</p>
  </section>

  <section class="card">
    <div class="card-head">
      <h2>채팅방</h2>
      <button type="button" @click="newRoom">새 채팅방</button>
    </div>
    <p class="muted">상시 방은 비어도 남고 순서대로 위에 보입니다. 회원 방은 회원이 채팅 화면에서 만든 방으로, 모두 나가면 사라집니다. 어느 방이든 [가입]한 사람만 대화합니다.</p>
    <p v-if="!rooms.length" class="muted">채팅방이 없습니다.</p>
    <div v-else class="table-wrap">
      <table class="table">
        <thead><tr><th>번호</th><th>순서</th><th>이름</th><th>종류</th><th>가입</th><th>사용</th><th>입장</th><th>메시지</th><th></th></tr></thead>
        <tbody>
          <tr v-for="r in rooms" :key="r.id" :class="{ inactive: !r.isActive }">
            <td class="muted">{{ r.id }}</td>
            <td>{{ r.isPermanent ? r.sortOrder : '-' }}</td>
            <td class="title-cell"><strong># {{ r.name }}</strong><br v-if="r.description" /><span class="muted">{{ r.description }}</span></td>
            <td>{{ r.isPermanent ? '상시 방' : `회원 방 · 방장 ${r.ownerName || '-'}` }}</td>
            <td>{{ r.memberCount }}명</td>
            <td>{{ r.isActive ? '사용' : '닫힘' }}</td>
            <td>{{ r.adminOnly ? '관리자만' : '모두' }}</td>
            <td>{{ r.messageCount }}개</td>
            <td class="row-actions">
              <button type="button" class="secondary" @click="editRoom(r)">수정</button>
              <button type="button" class="secondary" :disabled="!r.messageCount" @click="clearMessages(r)">기록 비우기</button>
              <button type="button" class="danger" @click="remove(r)">삭제</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>

  <!-- 연결 정보: 바꾸는 곳은 서버 설정 파일(server/.env)과 Nginx — 화면에서는 보기만 -->
  <section v-if="info" class="card">
    <h2>연결 정보</h2>
    <dl class="kv">
      <dt>포트</dt>
      <dd>
        채팅 <strong>{{ info.chatPort }}</strong>
        <span class="muted">{{ info.separate ? `— API(${info.port})와 따로 띄움` : '— API 와 같은 포트·같은 프로세스' }} ·
          <RouterLink to="/admin/settings">커뮤니티 설정 → 서버 포트</RouterLink></span>
      </dd>
      <dt>소켓 주소</dt><dd><code>{{ info.socketPath }}</code> <span class="muted">(공간 /chat — 방마다 room:번호)</span></dd>
      <dt>쓸 수 있는 권한</dt><dd>{{ roleLabel }}</dd>
      <dt>지금 접속</dt>
      <dd>
        <template v-if="info.chatOffline"><span class="error">채팅 서버에 연결할 수 없습니다 (pm2 logs 로 확인)</span></template>
        <template v-else>{{ info.online }}개 연결</template>
      </dd>
      <dt>명령어</dt>
      <dd>
        <ul class="chat-command-list">
          <li v-for="c in info.modules" :key="c.name"><code>{{ c.usage }}</code> <span class="muted">{{ c.description }}</span></li>
        </ul>
      </dd>
    </dl>
  </section>

  <ModalDialog v-if="editing" :title="editing.id ? '채팅방 수정' : '새 채팅방'" @close="editing = null">
    <template #actions>
      <button type="submit" form="room-form" :disabled="saving">{{ saving ? '저장 중…' : '저장' }}</button>
      <button type="button" class="secondary" @click="editing = null">취소</button>
    </template>
    <form id="room-form" class="form" @submit.prevent="save">
      <fieldset class="fieldset">
        <legend>채팅방</legend>
        <div class="field">
          <label for="room-name">이름<span class="req">*</span></label>
          <input id="room-name" v-model="editing.name" required maxlength="50" placeholder="예: 공지·잡담" />
        </div>
        <div class="field">
          <label for="room-desc">설명 <span class="muted">(방 위에 보임)</span></label>
          <input id="room-desc" v-model="editing.description" maxlength="255" />
        </div>
        <label class="toggle"><ToggleSwitch v-model="editing.isActive" /> 사용 <span class="muted">(끄면 목록에서 숨김, 기록은 남음)</span></label>
        <label class="toggle"><ToggleSwitch v-model="editing.adminOnly" /> 관리자만 입장</label>
        <label class="toggle"><ToggleSwitch v-model="editing.isPermanent" /> 상시 방 <span class="muted">(끄면 회원 방 — 모두 나가면 폭파, 지금 아무도 없으면 바로 사라짐)</span></label>
        <div class="field">
          <label for="room-order">순서 <span class="muted">(작을수록 위)</span></label>
          <input id="room-order" v-model.number="editing.sortOrder" class="narrow" type="number" step="1" />
        </div>
      </fieldset>
      <p v-if="editing.error" class="error">{{ editing.error }}</p>
    </form>
  </ModalDialog>
</template>
