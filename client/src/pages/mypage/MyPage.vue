<script setup>
import { ref, computed, onMounted } from 'vue';
import { api } from '../../api';
import { auth, APPLICATION_LABELS } from '../../auth';
import { fetchAttributes, toCharacterForm } from '../../character';
import CharacterCard from '../../components/CharacterCard.vue';
import CharacterForm from '../../components/CharacterForm.vue';
import { MarkdownView } from '../../markdown';
import ProfileList from '../../components/ProfileList.vue';
import ModalDialog from '../../components/ModalDialog.vue';
import AccountSection from '../../components/AccountSection.vue';
import { formatMoney } from '../../items';

const character = ref(null);
const definitions = ref(null);
const form = ref(null);       // null 이면 보기 모드, 값이 있으면 입력(생성/수정) 모드
const loaded = ref(false);
const error = ref('');
const saving = ref(false);

async function load() {
  const [me, defs, account] = await Promise.all([api('/characters/me'), fetchAttributes(), api('/auth/me')]);
  auth.user = account.user;   // 권한이 바뀌었을 수 있으므로(신청자 → 멤버) 최신으로
  character.value = me.character;
  definitions.value = defs;
  // 캐릭터가 없으면(기존 계정 등) 바로 등록 폼 표시
  form.value = me.character ? null : toCharacterForm(defs);
  loaded.value = true;
}

// 수정하기: 기본정보 + 스탯만 (프로필은 아래 프로필 카드에서)
function startEdit() {
  error.value = '';
  form.value = toCharacterForm(definitions.value, character.value);
}

async function save() {
  error.value = '';
  saving.value = true;
  try {
    const { character: saved } = character.value
      ? await api('/characters/me', { method: 'PUT', body: { name: form.value.name, hp: form.value.hp, stats: form.value.stats } })
      : await api('/characters', { method: 'POST', body: form.value });
    character.value = saved;
    form.value = null;
  } catch (e) {
    error.value = e.message;
  } finally {
    saving.value = false;
  }
}

// 신청자: 프로필은 [저장]만 하면 되고(동의 필요 없음), 처음 [신청서 제출]할 때 제출 동의사항 팝업에 동의
// 제출한 뒤에도 계속 수정할 수 있음
const isApplicant = computed(() => auth.user?.role === 'applicant');
const submitting = ref(null);   // 제출 팝업 { notice, agree, error }

async function openSubmit() {
  submitting.value = { notice: null, agree: false, error: '' };
  try {
    submitting.value.notice = (await api('/characters/me/application-notice')).notice;
  } catch (e) {
    submitting.value.notice = '';
    submitting.value.error = e.message;
  }
}

async function submitApplication() {
  submitting.value.error = '';
  saving.value = true;
  try {
    character.value = (await api('/characters/me/application/submit', { method: 'POST', body: { agree: true } })).character;
    submitting.value = null;
  } catch (e) {
    submitting.value.error = e.message;
  } finally {
    saving.value = false;
  }
}

onMounted(() => load().catch((e) => { error.value = e.message; loaded.value = true; }));
</script>

<template>
  <AccountSection />

  <!-- 신청자: 신청서 (프로필 저장은 자유, 처음 제출할 때 동의) -->
  <section v-if="isApplicant && loaded" class="card application-panel">
    <div class="card-head">
      <h2>캐릭터 신청</h2>
      <span v-if="character" class="badge" :class="character.applicationStatus">
        {{ character.applicationStatus === 'submitted' ? '제출 완료' : '작성중' }}
      </span>
    </div>
    <p v-if="!character" class="muted">아래에서 캐릭터를 작성한 뒤 신청서를 제출해주세요.</p>
    <template v-else-if="character.applicationStatus === 'draft'">
      <p class="muted">
        아래 캐릭터와 프로필을 작성하고 <strong>저장</strong>해 두세요. 다 작성했으면 <strong>신청서 제출</strong>을 눌러주세요.
        제출한 뒤에도 내용은 계속 수정할 수 있습니다.
      </p>
      <div class="actions">
        <button type="button" :disabled="saving || !!form" @click="openSubmit">신청서 제출</button>
      </div>
    </template>
    <p v-else class="muted">
      <template v-if="character.submittedAt">{{ new Date(character.submittedAt).toLocaleString('ko-KR') }}에 </template>신청서를 제출했습니다.
      관리자가 검토 중이며, 멤버로 전환되면 알림으로 알려드립니다. 내용은 계속 수정할 수 있습니다.
    </p>
  </section>

  <!-- 신청서 제출 동의 (관리 → 사이트 설정 → 신청서 제출 동의사항) -->
  <ModalDialog v-if="submitting" title="신청서 제출" @close="submitting = null">
    <form class="form" @submit.prevent="submitApplication">
      <p v-if="submitting.notice === null" class="muted">불러오는 중…</p>
      <div v-else-if="submitting.notice" class="signup-notice"><MarkdownView :source="submitting.notice" /></div>
      <label class="inline agree">
        <input v-model="submitting.agree" type="checkbox" />
        {{ submitting.notice ? '위 동의사항을 모두 읽었으며 동의합니다.' : '신청서 제출에 동의합니다.' }}
      </label>
      <p v-if="submitting.error" class="error">{{ submitting.error }}</p>
      <div class="actions">
        <button type="submit" :disabled="saving || !submitting.agree">{{ saving ? '제출 중…' : '제출' }}</button>
        <button type="button" class="secondary" @click="submitting = null">취소</button>
      </div>
    </form>
  </ModalDialog>

  <section class="card">
    <div class="card-head">
      <h2>내 캐릭터</h2>
      <div v-if="character" class="actions">
        <span class="money-badge">소지금 <strong>{{ formatMoney(character.money) }}</strong></span>
        <RouterLink to="/inventory" class="button secondary">인벤토리</RouterLink>
        <button class="secondary" @click="startEdit">수정하기</button>
      </div>
    </div>

    <p v-if="!loaded" class="muted">불러오는 중…</p>

    <!-- 캐릭터가 없으면 바로 등록 폼 -->
    <form v-else-if="form && !character" class="form" @submit.prevent="save">
      <p class="muted">아직 캐릭터가 없습니다. 캐릭터를 등록해주세요. (계정당 1개)</p>
      <CharacterForm v-model="form" :definitions="definitions" with-profile />
      <p v-if="error" class="error">{{ error }}</p>
      <div class="actions">
        <button type="submit" :disabled="saving">{{ saving ? '저장 중…' : '캐릭터 등록' }}</button>
      </div>
    </form>

    <CharacterCard v-else-if="character" :character="character" />

    <p v-if="error && !form" class="error">{{ error }}</p>
  </section>

  <!-- 수정하기: 기본정보 + 스탯 (프로필 수정과 같은 팝업 폼) -->
  <ModalDialog v-if="form && character" title="캐릭터 수정 — 기본정보 · 스탯" @close="form = null">
    <form class="form" @submit.prevent="save">
      <CharacterForm v-model="form" :definitions="definitions" />
      <p v-if="error" class="error">{{ error }}</p>
      <div class="actions">
        <button type="submit" :disabled="saving">{{ saving ? '저장 중…' : '저장' }}</button>
        <button type="button" class="secondary" @click="form = null">취소</button>
      </div>
    </form>
  </ModalDialog>

  <ProfileList v-if="character && definitions" :character="character" :definitions="definitions"
    :public-page="auth.user.role !== 'applicant'" @updated="(c) => { character = c; }" />
</template>
