<script setup>
import { ref, onMounted } from 'vue';
import { api } from '../api';
import { auth } from '../auth';
import { fetchAttributes, toCharacterForm } from '../character';
import CharacterCard from '../components/CharacterCard.vue';
import CharacterForm from '../components/CharacterForm.vue';
import ProfileSection from '../components/ProfileSection.vue';
import { formatMoney } from '../items';

const character = ref(null);
const definitions = ref(null);
const form = ref(null);       // null 이면 보기 모드, 값이 있으면 입력(생성/수정) 모드
const loaded = ref(false);
const error = ref('');
const saving = ref(false);

async function load() {
  const [me, defs] = await Promise.all([api('/characters/me'), fetchAttributes()]);
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

onMounted(() => load().catch((e) => { error.value = e.message; loaded.value = true; }));
</script>

<template>
  <section class="card">
    <h1>마이페이지</h1>
    <dl class="kv">
      <dt>이름</dt><dd>{{ auth.user.name }}</dd>
      <dt>이메일</dt><dd>{{ auth.user.email }}</dd>
      <dt>권한</dt>
      <dd><span class="badge" :class="auth.user.role">{{ auth.user.role === 'admin' ? '관리자' : '일반' }}</span></dd>
    </dl>
  </section>

  <section class="card">
    <div class="card-head">
      <h2>내 캐릭터</h2>
      <div v-if="character && !form" class="actions">
        <span class="money-badge">소지금 <strong>{{ formatMoney(character.money) }}</strong></span>
        <RouterLink to="/inventory" class="button secondary">인벤토리</RouterLink>
        <button class="secondary" @click="startEdit">수정하기</button>
      </div>
    </div>

    <p v-if="!loaded" class="muted">불러오는 중…</p>

    <form v-else-if="form" class="form" @submit.prevent="save">
      <p v-if="!character" class="muted">아직 캐릭터가 없습니다. 캐릭터를 등록해주세요. (계정당 1개)</p>
      <p v-else class="muted">기본정보와 캐릭터 스탯을 수정합니다. 프로필은 아래 프로필에서 각각 수정하세요.</p>
      <CharacterForm v-model="form" :definitions="definitions" :with-profile="!character" />
      <p v-if="error" class="error">{{ error }}</p>
      <div class="actions">
        <button type="submit" :disabled="saving">{{ saving ? '저장 중…' : character ? '저장' : '캐릭터 등록' }}</button>
        <button v-if="character" type="button" class="secondary" @click="form = null">취소</button>
      </div>
    </form>

    <CharacterCard v-else-if="character" :character="character" />

    <p v-if="error && !form" class="error">{{ error }}</p>
  </section>

  <ProfileSection v-if="character && definitions" :character="character" :definitions="definitions"
    @updated="(c) => { character = c; }" />
</template>
