<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { signup } from '../../auth';
import { fetchAttributes, toCharacterForm } from '../../character';
import CharacterForm from '../../components/CharacterForm.vue';
import { site } from '../../site';

const router = useRouter();
const name = ref('');
const email = ref('');
const password = ref('');
const definitions = ref(null);
const character = ref(null);
const error = ref('');
const loading = ref(false);

onMounted(async () => {
  try {
    definitions.value = await fetchAttributes();
    character.value = toCharacterForm(definitions.value);
  } catch (e) {
    error.value = e.message;
  }
});

async function submit() {
  error.value = '';
  loading.value = true;
  try {
    await signup({ name: name.value, email: email.value, password: password.value, character: character.value });
    router.push('/mypage');
  } catch (e) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <section class="card">
    <RouterLink v-if="site.private" to="/login" class="muted">← 로그인으로</RouterLink>
    <h1>회원가입</h1>
    <form class="form" @submit.prevent="submit">
      <fieldset class="fieldset">
        <legend>계정</legend>
        <label>이름 <input v-model="name" autocomplete="name" required maxlength="50" /></label>
        <label>이메일 <input v-model="email" type="email" autocomplete="email" required /></label>
        <label>비밀번호 (8자 이상) <input v-model="password" type="password" autocomplete="new-password" required minlength="8" /></label>
      </fieldset>

      <h2 class="section-title">내 캐릭터 등록</h2>
      <CharacterForm v-if="character" v-model="character" :definitions="definitions" />
      <p v-else-if="!error" class="muted">항목을 불러오는 중…</p>

      <p v-if="error" class="error">{{ error }}</p>
      <button type="submit" :disabled="loading || !character">{{ loading ? '가입 중…' : '가입하기' }}</button>
    </form>
  </section>
</template>
