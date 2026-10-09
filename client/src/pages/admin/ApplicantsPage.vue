<script setup>
// 관리자: 신청자 관리 — 신청자 캐릭터(프로필) 확인, 체크해서 한꺼번에 멤버 전환 / 삭제
import { ref, computed, watch, onMounted } from 'vue';
import { api } from '../../api';
import { APPLICATION_LABELS } from '../../auth';
import { formatDate } from '../../boards';
import ModalDialog from '../../components/ModalDialog.vue';
import CharacterCard from '../../components/CharacterCard.vue';
import ProfileSection from '../../components/ProfileSection.vue';

const FILTERS = [
  { value: 'submitted', label: '제출 완료' },
  { value: 'draft', label: '작성중' },
  { value: '', label: '전체' },
];

const applicants = ref([]);
const counts = ref({ total: 0, submitted: 0, draft: 0, noCharacter: 0 });
const status = ref('submitted');
const q = ref('');
const selected = ref(new Set());   // 체크한 캐릭터 id
const loading = ref(false);
const busy = ref(false);
const error = ref('');
const message = ref('');
const viewing = ref(null);         // 상세 보기 (팝업)

const allChecked = computed(() => applicants.value.length > 0 && applicants.value.every((a) => selected.value.has(a.id)));
const selectedList = computed(() => applicants.value.filter((a) => selected.value.has(a.id)));

async function load() {
  loading.value = true;
  error.value = '';
  try {
    const params = new URLSearchParams();
    if (status.value) params.set('status', status.value);
    if (q.value.trim()) params.set('q', q.value.trim());
    const data = await api(`/admin/applicants?${params}`);
    applicants.value = data.applicants;
    counts.value = data.counts;
    // 목록에 없는 체크는 해제
    const ids = new Set(data.applicants.map((a) => a.id));
    selected.value = new Set([...selected.value].filter((id) => ids.has(id)));
  } catch (e) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
}

function toggle(id) {
  const next = new Set(selected.value);
  if (next.has(id)) next.delete(id); else next.add(id);
  selected.value = next;
}

function toggleAll() {
  selected.value = allChecked.value ? new Set() : new Set(applicants.value.map((a) => a.id));
}

const namesOf = (list) => {
  const names = list.map((a) => a.name);
  return names.length > 5 ? `${names.slice(0, 5).join(', ')} 외 ${names.length - 5}명` : names.join(', ');
};

async function bulk(action) {
  const list = selectedList.value;
  if (!list.length) return;
  const drafts = list.filter((a) => a.applicationStatus === 'draft').length;
  const warn = drafts ? `\n(그중 ${drafts}명은 아직 작성중입니다)` : '';
  const ok = action === 'accept'
    ? confirm(`${list.length}명을 멤버로 전환할까요?${warn}\n${namesOf(list)}\n\n신청한 프로필이 대표 프로필이 되고, 멤버란에 공개됩니다.`)
    : confirm(`${list.length}명의 캐릭터와 프로필을 모두 삭제할까요?${warn}\n${namesOf(list)}\n\n되돌릴 수 없습니다. (계정은 남아서 다시 신청할 수 있습니다)`);
  if (!ok) return;

  busy.value = true;
  error.value = '';
  message.value = '';
  try {
    const body = { characterIds: list.map((a) => a.id) };
    if (action === 'accept') {
      const r = await api('/admin/applicants/accept', { method: 'POST', body });
      message.value = `${r.accepted.length}명을 멤버로 전환했습니다.${r.skipped ? ` (${r.skipped}명은 이미 신청자가 아니라서 건너뜀)` : ''}`;
    } else {
      const r = await api('/admin/applicants/delete', { method: 'POST', body });
      message.value = `${r.deleted.length}명의 신청 프로필을 삭제했습니다.${r.skipped ? ` (${r.skipped}명은 건너뜀)` : ''}`;
    }
    selected.value = new Set();
    await load();
  } catch (e) {
    error.value = e.message;
  } finally {
    busy.value = false;
  }
}

async function view(a) {
  error.value = '';
  try {
    viewing.value = (await api(`/admin/applicants/${a.id}`)).character;
  } catch (e) {
    error.value = e.message;
  }
}

// 팝업에서 이 신청자만 체크
function checkViewing() {
  const next = new Set(selected.value);
  next.add(viewing.value.id);
  selected.value = next;
  viewing.value = null;
}

watch(status, load);
onMounted(load);
</script>

<template>
  <section class="card">
    <div class="card-head">
      <h1>신청자 관리</h1>
      <span class="muted">
        신청자 {{ counts.total }}명 · 제출 완료 {{ counts.submitted }} · 작성중 {{ counts.draft }}
        <template v-if="counts.noCharacter"> · 캐릭터 없음 {{ counts.noCharacter }}</template>
      </span>
    </div>
    <p class="muted">
      신청자의 캐릭터는 멤버란에 보이지 않습니다. 체크한 뒤 <strong>멤버로 전환</strong>하면 신청 프로필이 대표 프로필이 되어 멤버란에 공개되고,
      <strong>삭제</strong>하면 캐릭터와 프로필이 모두 지워집니다(계정은 남아 다시 신청 가능).
    </p>

    <div class="tabs profile-tabs" role="tablist">
      <button v-for="f in FILTERS" :key="f.value" type="button" role="tab" :aria-selected="status === f.value"
        :class="{ active: status === f.value }" @click="status = f.value">
        {{ f.label }}
        <span class="muted">{{ f.value === 'submitted' ? counts.submitted : f.value === 'draft' ? counts.draft : counts.total }}</span>
      </button>
    </div>

    <form class="add-row" @submit.prevent="load">
      <input v-model="q" type="search" placeholder="캐릭터 이름 / 아이디 / 소통 계정" />
      <button type="submit" class="secondary">검색</button>
    </form>

    <div class="bulk-bar">
      <span class="count"><strong>{{ selected.size }}</strong>명 선택</span>
      <button type="button" :disabled="busy || !selected.size" @click="bulk('accept')">멤버로 전환</button>
      <button type="button" class="danger" :disabled="busy || !selected.size" @click="bulk('delete')">프로필 삭제</button>
    </div>

    <p v-if="error" class="error">{{ error }}</p>
    <p v-if="message" class="ok">{{ message }}</p>

    <p v-if="loading && !applicants.length" class="muted">불러오는 중…</p>
    <p v-else-if="!applicants.length" class="muted">해당하는 신청자가 없습니다.</p>
    <div v-else class="table-wrap">
      <table class="table">
        <thead>
          <tr>
            <th class="check"><input type="checkbox" :checked="allChecked" aria-label="전체 선택" @change="toggleAll" /></th>
            <th />
            <th>캐릭터</th>
            <th>상태</th>
            <th>회원</th>
            <th>제출일</th>
            <th>수정일</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="a in applicants" :key="a.id" :class="{ checked: selected.has(a.id) }">
            <td class="check"><input type="checkbox" :checked="selected.has(a.id)" :aria-label="`${a.name} 선택`" @change="toggle(a.id)" /></td>
            <td>
              <img v-if="a.thumbnail" :src="a.thumbnail" alt="" class="applicant-thumb" loading="lazy" />
              <span v-else class="applicant-thumb" />
            </td>
            <td><button type="button" class="link-button" @click="view(a)">{{ a.name }}</button></td>
            <td><span class="badge" :class="a.applicationStatus">{{ APPLICATION_LABELS[a.applicationStatus] }}</span></td>
            <td>{{ a.user.username }} <span class="muted">{{ a.user.contact }}</span></td>
            <td>{{ a.submittedAt ? formatDate(a.submittedAt) : '-' }}</td>
            <td>{{ formatDate(a.updatedAt) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>

  <ModalDialog v-if="viewing" :title="`신청자 프로필 — ${viewing.name}`" @close="viewing = null">
    <template #actions>
      <button v-if="!selected.has(viewing.id)" type="button" class="secondary" @click="checkViewing">선택에 추가</button>
      <button type="button" class="secondary" @click="viewing = null">닫기</button>
    </template>
    <p>
      <span class="badge" :class="viewing.applicationStatus">{{ APPLICATION_LABELS[viewing.applicationStatus] }}</span>
      <span v-if="viewing.submittedAt" class="muted"> 제출 {{ formatDate(viewing.submittedAt) }}</span>
    </p>
    <CharacterCard :character="viewing" />
    <ProfileSection :key="viewing.id" :character="viewing" :play-music="false" />
  </ModalDialog>
</template>
