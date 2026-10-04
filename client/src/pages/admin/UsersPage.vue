<script setup>
// 관리자: 회원 관리 — 아이디·소통 계정·권한·캐릭터 목록, 비밀번호 강제 변경
import { ref, computed, watch, onMounted } from 'vue';
import { api } from '../../api';
import { ROLE_LABELS, roleLabel } from '../../auth';
import ModalDialog from '../../components/ModalDialog.vue';

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

    <div class="table-wrap">
      <table class="table">
        <thead>
          <tr><th>아이디</th><th>소통 계정</th><th>권한</th><th>캐릭터</th><th>가입</th><th>마지막 로그인</th><th /></tr>
        </thead>
        <tbody>
          <tr v-for="u in users" :key="u.id">
            <td><strong>{{ u.username }}</strong></td>
            <td>{{ u.contact || '-' }}</td>
            <td><span class="badge" :class="u.role">{{ roleLabel(u.role) }}</span></td>
            <td>
              <RouterLink v-if="u.character && u.role !== 'applicant'" :to="`/members/${u.character.id}`">{{ u.character.name }}</RouterLink>
              <span v-else-if="u.character">{{ u.character.name }}</span>
              <span v-else class="muted">없음</span>
            </td>
            <td>{{ formatTime(u.createdAt) }}</td>
            <td>{{ formatTime(u.lastLoginAt) }}</td>
            <td><button type="button" class="secondary small" @click="openReset(u)">비밀번호 변경</button></td>
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
