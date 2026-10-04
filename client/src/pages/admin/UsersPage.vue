<script setup>
// 관리자: 회원 관리 — 아이디·소통 계정·권한·캐릭터 목록, 비밀번호 강제 변경, 권한 변경·삭제 (한 명씩 또는 체크해서 일괄)
import { ref, computed, watch, onMounted } from 'vue';
import { api } from '../../api';
import { auth, ROLE_LABELS, roleLabel } from '../../auth';
import ModalDialog from '../../components/ModalDialog.vue';
import BulkBar from '../../components/BulkBar.vue';
import { useSelection } from '../../selection';

const users = ref([]);
const total = ref(0);
const pageSize = ref(50);
const page = ref(1);
const q = ref('');
const role = ref('');
const error = ref('');
const message = ref('');
const resetting = ref(null);   // { user, password }
const busy = ref(false);

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)));
const formatTime = (v) => (v ? new Date(v).toLocaleString('ko-KR') : '-');

async function load() {
  error.value = '';
  try {
    const params = new URLSearchParams({ page: String(page.value) });
    if (q.value.trim()) params.set('q', q.value.trim());
    if (role.value) params.set('role', role.value);
    const data = await api(`/admin/users?${params}`);
    users.value = data.users;
    total.value = data.total;
    pageSize.value = data.pageSize;
  } catch (e) {
    error.value = e.message;
  }
}

function search() {
  page.value = 1;
  load();
}

// 임시 비밀번호 만들기 (헷갈리는 글자 0/O, 1/l 제외)
function randomPassword() {
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  return Array.from(bytes, (b) => chars[b % chars.length]).join('');
}

function openReset(user) {
  message.value = '';
  resetting.value = { user, password: randomPassword() };
}

async function reset() {
  const { user, password } = resetting.value;
  busy.value = true;
  error.value = '';
  try {
    await api(`/admin/users/${user.id}/password`, { method: 'PUT', body: { newPassword: password } });
    message.value = `'${user.username}' 비밀번호를 바꿨습니다. 새 비밀번호: ${password} — 회원에게 전달해주세요.`;
    resetting.value = null;
  } catch (e) {
    error.value = e.message;
  } finally {
    busy.value = false;
  }
}

// ---------- 권한 변경 / 삭제 (내 계정은 제외) ----------
const selectable = computed(() => users.value.filter((u) => u.id !== auth.user?.id));
const sel = useSelection(() => selectable.value);
const bulkRole = ref('member');
const namesOf = (list) => (list.length > 5 ? `${list.slice(0, 5).map((u) => u.username).join(', ')} 외 ${list.length - 5}명` : list.map((u) => u.username).join(', '));

async function act(fn) {
  error.value = '';
  message.value = '';
  busy.value = true;
  try {
    message.value = await fn();
    sel.clear();
    await load();
  } catch (e) {
    error.value = e.message;
  } finally {
    busy.value = false;
  }
}

function changeRole(list, newRole) {
  if (!list.length) return;
  if (!confirm(`${list.length}명의 권한을 '${roleLabel(newRole)}'(으)로 바꿀까요?\n${namesOf(list)}`)) return;
  return act(async () => {
    const r = await api('/admin/users/role', { method: 'PATCH', body: { ids: list.map((u) => u.id), role: newRole } });
    return `${r.updated}명의 권한을 '${roleLabel(newRole)}'(으)로 바꿨습니다.${r.skipped ? ` (${r.skipped}명은 이미 같은 권한)` : ''}`;
  });
}

function removeUsers(list) {
  if (!list.length) return;
  const withChar = list.filter((u) => u.character).length;
  if (!confirm(`${list.length}명을 삭제할까요?\n${namesOf(list)}\n\n`
    + `계정과 함께 캐릭터·프로필·인벤토리·기록·Q&A 글·알림이 모두 삭제됩니다${withChar ? ` (캐릭터 ${withChar}개)` : ''}.\n되돌릴 수 없습니다.`)) return;
  return act(async () => {
    const r = await api('/admin/users/bulk-delete', { method: 'POST', body: { ids: list.map((u) => u.id) } });
    return `${r.deleted}명을 삭제했습니다.`;
  });
}

const selectedUsers = () => selectable.value.filter((u) => sel.has(u.id));

watch(role, search);
watch(page, load);
onMounted(load);
</script>

<template>
  <section class="card">
    <div class="card-head">
      <h1>회원 관리</h1>
      <span class="muted">{{ total }}명</span>
    </div>
    <form class="add-row" @submit.prevent="search">
      <input v-model="q" type="search" placeholder="아이디 / 소통 계정 / 캐릭터 이름" />
      <select v-model="role" aria-label="권한">
        <option value="">전체 권한</option>
        <option v-for="(label, key) in ROLE_LABELS" :key="key" :value="key">{{ label }}</option>
      </select>
      <button type="submit" class="secondary">검색</button>
    </form>

    <p v-if="error" class="error">{{ error }}</p>
    <p v-if="message" class="ok copyable">{{ message }}</p>

    <BulkBar v-if="users.length" :count="sel.ids.value.length" @clear="sel.clear()">
      <select v-model="bulkRole" aria-label="바꿀 권한" class="bulk-select">
        <option v-for="(label, key) in ROLE_LABELS" :key="key" :value="key">{{ label }}</option>
      </select>
      <button type="button" :disabled="busy || !sel.ids.value.length" @click="changeRole(selectedUsers(), bulkRole)">(으)로 권한 변경</button>
      <button type="button" class="danger" :disabled="busy || !sel.ids.value.length" @click="removeUsers(selectedUsers())">선택 삭제</button>
    </BulkBar>

    <div class="table-wrap">
      <table class="table">
        <thead>
          <tr>
            <th class="check">
              <input type="checkbox" aria-label="전체 선택" :checked="sel.allChecked.value" :indeterminate="sel.someChecked.value"
                :disabled="!selectable.length" @change="sel.toggleAll()" />
            </th>
            <th>아이디</th><th>소통 계정</th><th>권한</th><th>캐릭터</th><th>가입</th><th>마지막 로그인</th><th />
          </tr>
        </thead>
        <tbody>
          <tr v-for="u in users" :key="u.id" :class="{ checked: sel.has(u.id) }">
            <td class="check">
              <input v-if="u.id !== auth.user?.id" type="checkbox" :aria-label="`${u.username} 선택`" :checked="sel.has(u.id)" @change="sel.toggle(u.id)" />
            </td>
            <td><strong>{{ u.username }}</strong> <span v-if="u.id === auth.user?.id" class="muted">(나)</span></td>
            <td>{{ u.contact || '-' }}</td>
            <td>
              <span v-if="u.id === auth.user?.id" class="badge" :class="u.role">{{ roleLabel(u.role) }}</span>
              <select v-else :value="u.role" class="role-select" :aria-label="`${u.username} 권한`" :disabled="busy"
                @change="(e) => { const r = e.target.value; e.target.value = u.role; changeRole([u], r); }">
                <option v-for="(label, key) in ROLE_LABELS" :key="key" :value="key">{{ label }}</option>
              </select>
            </td>
            <td>
              <!-- 신청자의 신청서도 관리자는 볼 수 있음 -->
              <RouterLink v-if="u.character" :to="`/members/${u.character.id}`">{{ u.character.name }}</RouterLink>
              <span v-else class="muted">없음</span>
            </td>
            <td>{{ formatTime(u.createdAt) }}</td>
            <td>{{ formatTime(u.lastLoginAt) }}</td>
            <td class="row-actions">
              <button type="button" class="secondary small" @click="openReset(u)">비밀번호 변경</button>
              <button v-if="u.id !== auth.user?.id" type="button" class="danger small" :disabled="busy" @click="removeUsers([u])">삭제</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <p v-if="!users.length && !error" class="muted">회원이 없습니다.</p>

    <nav v-if="totalPages > 1" class="pager">
      <button type="button" class="secondary" :disabled="page <= 1" @click="page--">이전</button>
      <span>{{ page }} / {{ totalPages }}</span>
      <button type="button" class="secondary" :disabled="page >= totalPages" @click="page++">다음</button>
    </nav>
  </section>

  <ModalDialog v-if="resetting" :title="`비밀번호 강제 변경 — ${resetting.user.username}`" @close="resetting = null">
    <form class="form" @submit.prevent="reset">
      <p class="muted">새 비밀번호로 바뀌고, 이 회원은 로그인된 모든 기기에서 로그아웃됩니다. 바꾼 비밀번호를 회원에게 전달해주세요.</p>
      <label>
        새 비밀번호 <span class="muted">(8자 이상)</span>
        <div class="add-row">
          <input v-model="resetting.password" required minlength="8" maxlength="100" autocomplete="off" spellcheck="false" />
          <button type="button" class="secondary" @click="resetting.password = randomPassword()">임시 비밀번호 생성</button>
        </div>
      </label>
      <div class="actions">
        <button type="submit" class="danger" :disabled="busy">비밀번호 변경</button>
        <button type="button" class="secondary" @click="resetting = null">취소</button>
      </div>
    </form>
  </ModalDialog>
</template>
