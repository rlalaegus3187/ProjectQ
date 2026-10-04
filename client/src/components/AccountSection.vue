<script setup>
// 마이페이지 계정(오너) 정보: 아이디(변경 불가), 소통 계정(수정), 약관동의(누르면 동의한 안내 팝업), 권한, 비밀번호 변경, 계정 삭제
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import {
  auth, roleLabel, updateContact, changePassword, fetchAgreement, agreeNotice, deleteAccount,
} from '../auth';
import { refreshUnread } from '../notifications';
import { MarkdownView } from '../markdown';
import ModalDialog from './ModalDialog.vue';

const editingContact = ref(false);
const contact = ref('');
const pw = ref(null);   // 비밀번호 변경 폼 { current, next, confirm }
const busy = ref(false);
const error = ref('');
const message = ref('');

// 약관동의 팝업: { agreedAt, notice } (불러오는 중이면 loading)
const agreement = ref(null);
const agreeChecked = ref(false);

async function openAgreement() {
  agreeChecked.value = false;
  agreement.value = { loading: true };
  try {
    agreement.value = await fetchAgreement();
  } catch (e) {
    agreement.value = null;
    error.value = e.message;
  }
}

const confirmAgreement = () => run(async () => {
  await agreeNotice();
  agreement.value = await fetchAgreement();
  message.value = '안내에 동의했습니다.';
});

// 계정 삭제 팝업: { password, understood, error }
const router = useRouter();
const removing = ref(null);

function openDelete() {
  removing.value = { password: '', understood: false, error: '' };
}

async function confirmDelete() {
  removing.value.error = '';
  busy.value = true;
  try {
    const name = auth.user.username;
    await deleteAccount(removing.value.password);
    await refreshUnread({ force: true });
    removing.value = null;
    alert(`'${name}' 계정을 삭제했습니다. 이용해주셔서 감사합니다.`);
    router.push('/');
  } catch (e) {
    removing.value.error = e.message;
  } finally {
    busy.value = false;
  }
}

const formatTime = (v) => new Date(v).toLocaleString('ko-KR');

const pwMismatch = computed(() => !!pw.value?.confirm && pw.value.next !== pw.value.confirm);

function startContact() {
  contact.value = auth.user.contact || '';
  editingContact.value = true;
  pw.value = null;
  error.value = '';
  message.value = '';
}

async function run(fn) {
  error.value = '';
  message.value = '';
  busy.value = true;
  try {
    await fn();
  } catch (e) {
    error.value = e.message;
  } finally {
    busy.value = false;
  }
}

const saveContact = () => run(async () => {
  await updateContact(contact.value);
  editingContact.value = false;
  message.value = '소통 계정을 저장했습니다.';
});

const savePassword = () => run(async () => {
  if (pwMismatch.value) throw new Error('새 비밀번호 확인이 일치하지 않습니다.');
  await changePassword(pw.value.current, pw.value.next);
  pw.value = null;
  message.value = '비밀번호를 바꿨습니다. 다른 기기에서는 다시 로그인해야 합니다.';
});
</script>

<template>
  <section class="card">
    <h1>마이페이지</h1>
    <dl class="kv">
      <dt>아이디</dt><dd>{{ auth.user.username }}</dd>
      <dt>소통 계정</dt>
      <dd>
        <form v-if="editingContact" class="add-row" @submit.prevent="saveContact">
          <input v-model="contact" required maxlength="100" placeholder="예: 트위터 @아이디, 디스코드 아이디" />
          <button type="submit" :disabled="busy">저장</button>
          <button type="button" class="secondary" @click="editingContact = false">취소</button>
        </form>
        <template v-else>
          <span v-if="auth.user.contact">{{ auth.user.contact }}</span>
          <span v-else class="error">입력해주세요</span>
          <button type="button" class="link small-link" @click="startContact">수정</button>
        </template>
      </dd>
      <dt>약관동의</dt>
      <dd>
        <button type="button" class="badge-button" :class="auth.user.agreedAt ? 'done' : 'todo'" @click="openAgreement">
          {{ auth.user.agreedAt ? '완료' : '미완료' }}
        </button>
      </dd>
      <dt>권한</dt>
      <dd><span class="badge" :class="auth.user.role">{{ roleLabel(auth.user.role) }}</span></dd>
    </dl>

    <ModalDialog v-if="agreement" title="회원가입 안내 (약관)" @close="agreement = null">
      <p v-if="agreement.loading" class="muted">불러오는 중…</p>
      <template v-else>
        <p v-if="agreement.agreedAt" class="ok">{{ formatTime(agreement.agreedAt) }}에 동의했습니다.</p>
        <p v-else class="muted">동의 기록이 없습니다. 아래 안내를 읽고 동의해주세요.</p>
        <div class="signup-notice">
          <MarkdownView v-if="agreement.notice" :source="agreement.notice" />
          <p v-else class="muted">등록된 안내가 없습니다.</p>
        </div>
        <form v-if="!agreement.agreedAt" class="form" @submit.prevent="confirmAgreement">
          <label class="inline agree"><input v-model="agreeChecked" type="checkbox" /> 위 안내를 모두 읽었으며 동의합니다.</label>
          <button type="submit" :disabled="busy || !agreeChecked">동의하기</button>
        </form>
        <div v-else class="actions">
          <button type="button" class="secondary" @click="agreement = null">닫기</button>
        </div>
      </template>
    </ModalDialog>

    <form v-if="pw" class="form password-change" @submit.prevent="savePassword">
      <h3 class="section-title">비밀번호 변경</h3>
      <label>현재 비밀번호 <input v-model="pw.current" type="password" required autocomplete="current-password" /></label>
      <label>새 비밀번호 <span class="muted">(8자 이상)</span>
        <input v-model="pw.next" type="password" required minlength="8" maxlength="100" autocomplete="new-password" />
      </label>
      <label>새 비밀번호 확인
        <input v-model="pw.confirm" type="password" required minlength="8" maxlength="100" autocomplete="new-password" :class="{ invalid: pwMismatch }" />
        <span v-if="pwMismatch" class="error">새 비밀번호가 일치하지 않습니다.</span>
      </label>
      <div class="actions">
        <button type="submit" :disabled="busy">비밀번호 변경</button>
        <button type="button" class="secondary" @click="pw = null">취소</button>
      </div>
    </form>
    <div v-else class="actions account-actions">
      <button type="button" class="secondary" @click="pw = { current: '', next: '', confirm: '' }; editingContact = false; message = ''; error = ''">
        비밀번호 변경
      </button>
    </div>

    <p v-if="error" class="error">{{ error }}</p>
    <p v-if="message" class="ok">{{ message }}</p>

    <div class="danger-zone">
      <div>
        <strong>계정 삭제</strong>
        <p class="muted">계정과 캐릭터가 모두 삭제되며 복구할 수 없습니다.</p>
      </div>
      <button type="button" class="danger" @click="openDelete">계정 삭제하기</button>
    </div>

    <ModalDialog v-if="removing" title="계정 삭제" @close="removing = null">
      <form class="form" @submit.prevent="confirmDelete">
        <div class="delete-warning">
          <p><strong>삭제한 계정은 복구할 수 없습니다.</strong> 아래 내용이 모두 즉시 삭제되며, 관리자도 되돌릴 수 없습니다.</p>
          <ul>
            <li>계정 <strong>{{ auth.user.username }}</strong> (같은 아이디로 다시 가입할 수는 있습니다)</li>
            <li>캐릭터와 모든 프로필, 캐릭터 스탯</li>
            <li>인벤토리 아이템, 소지금, 아이템·소지금 기록</li>
            <li>내가 쓴 Q&amp;A 글과 그 답변, 받은 알림</li>
          </ul>
        </div>
        <label>
          비밀번호 확인
          <input v-model="removing.password" type="password" required autocomplete="current-password" />
        </label>
        <label class="inline agree">
          <input v-model="removing.understood" type="checkbox" /> 복구할 수 없다는 것을 이해했으며 계정을 삭제합니다.
        </label>
        <p v-if="removing.error" class="error">{{ removing.error }}</p>
        <div class="actions">
          <button type="submit" class="danger" :disabled="busy || !removing.understood || !removing.password">계정 영구 삭제</button>
          <button type="button" class="secondary" @click="removing = null">취소</button>
        </div>
      </form>
    </ModalDialog>
  </section>
</template>
