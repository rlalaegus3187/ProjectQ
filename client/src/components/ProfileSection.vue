<script setup>
// 캐릭터 프로필 여러 개: 탭으로 전환, 추가 / 수정 / 삭제 / 대표 지정
// 스탯·기본정보는 캐릭터에 하나, 프로필 양식 값만 프로필마다 따로
import { ref, computed, watch } from 'vue';
import { api } from '../api';
import { toProfileForm } from '../character';
import AttributeValue from './AttributeValue.vue';
import ProfileFields from './ProfileFields.vue';

const props = defineProps({
  character: { type: Object, required: true },
  definitions: { type: Object, default: null },   // readonly 면 필요 없음
  readonly: { type: Boolean, default: false },     // 멤버란 등 보기 전용
});
const emit = defineEmits(['updated']);   // 서버가 돌려준 최신 캐릭터

const selectedId = ref(props.character.profiles[0]?.id ?? null);
const form = ref(null);          // 편집 중인 프로필 { name, details }
const editingId = ref(null);     // null + form 있으면 새 프로필
const error = ref('');
const busy = ref(false);

const profiles = computed(() => props.character.profiles);
const selected = computed(() => profiles.value.find((p) => p.id === selectedId.value) ?? profiles.value[0]);
const canAdd = computed(() => profiles.value.length < (props.character.maxProfiles ?? 10));

// 목록이 바뀌어 선택한 프로필이 없어지면 대표 프로필로
watch(profiles, (list) => {
  if (!list.some((p) => p.id === selectedId.value)) selectedId.value = list[0]?.id ?? null;
});

function select(id) {
  if (form.value && !confirm('수정 중인 내용이 사라집니다. 이동할까요?')) return;
  form.value = null;
  selectedId.value = id;
}

function startAdd() {
  error.value = '';
  editingId.value = null;
  form.value = toProfileForm(props.definitions);
}

function startEdit() {
  error.value = '';
  editingId.value = selected.value.id;
  form.value = toProfileForm(props.definitions, selected.value);
}

async function run(fn) {
  error.value = '';
  busy.value = true;
  try {
    const { character } = await fn();
    emit('updated', character);
    return character;
  } catch (e) {
    error.value = e.message;
    return null;
  } finally {
    busy.value = false;
  }
}

async function save() {
  const isNew = editingId.value === null;
  const character = await run(() => (isNew
    ? api('/characters/me/profiles', { method: 'POST', body: form.value })
    : api(`/characters/me/profiles/${editingId.value}`, { method: 'PUT', body: form.value })));
  if (!character) return;
  // 새 프로필이면 방금 만든 프로필(가장 큰 id)을 선택
  if (isNew) selectedId.value = Math.max(...character.profiles.map((p) => p.id));
  form.value = null;
}

const makeMain = () => run(() => api(`/characters/me/profiles/${selected.value.id}/main`, { method: 'PUT' }));

async function remove() {
  if (!confirm(`'${selected.value.name}' 프로필을 삭제할까요? 되돌릴 수 없습니다.`)) return;
  await run(() => api(`/characters/me/profiles/${selected.value.id}`, { method: 'DELETE' }));
}
</script>

<template>
  <section class="card">
    <div class="card-head">
      <h2>프로필 <span v-if="!readonly" class="muted">{{ profiles.length }} / {{ character.maxProfiles ?? 10 }}</span></h2>
      <button v-if="!readonly && !form && canAdd" type="button" class="secondary" @click="startAdd">+ 새 프로필</button>
    </div>

    <div class="tabs profile-tabs" role="tablist">
      <button v-for="p in profiles" :key="p.id" type="button" role="tab" :aria-selected="p.id === selected?.id"
        :class="{ active: form ? editingId === p.id : p.id === selected?.id }" @click="select(p.id)">
        <span v-if="p.isMain" class="badge pin">대표</span> {{ p.name }}
      </button>
      <button v-if="form && editingId === null" type="button" class="active" role="tab" aria-selected="true">새 프로필</button>
    </div>

    <form v-if="form" class="form" @submit.prevent="save">
      <ProfileFields v-model:name="form.name" v-model:details="form.details" :definitions="definitions"
        :legend="editingId === null ? '새 프로필' : '프로필 수정'" />
      <p v-if="error" class="error">{{ error }}</p>
      <div class="actions">
        <button type="submit" :disabled="busy">{{ busy ? '저장 중…' : editingId === null ? '프로필 추가' : '저장' }}</button>
        <button type="button" class="secondary" @click="form = null">취소</button>
      </div>
    </form>

    <template v-else-if="selected">
      <div v-if="!readonly" class="actions profile-actions">
        <button type="button" class="secondary" @click="startEdit">프로필 수정</button>
        <button v-if="!selected.isMain" type="button" class="secondary" :disabled="busy" @click="makeMain">대표로 지정</button>
        <button v-if="!selected.isMain" type="button" class="danger" :disabled="busy" @click="remove">삭제</button>
      </div>
      <p v-if="!selected.details.length" class="muted">등록된 프로필 양식이 없습니다.</p>
      <dl v-else class="kv">
        <template v-for="detail in selected.details" :key="detail.code">
          <dt>{{ detail.label }}</dt><dd><AttributeValue :attr="detail" /></dd>
        </template>
      </dl>
      <p v-if="error" class="error">{{ error }}</p>
    </template>
  </section>
</template>
