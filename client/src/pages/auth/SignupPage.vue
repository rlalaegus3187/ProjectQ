<script setup>
// 회원가입: 아이디 / 비밀번호 / 소통 계정 + 가입 안내(관리 → 사이트 설정에서 작성) 동의
// 캐릭터는 가입한 뒤 마이페이지에서 작성 (가입하면 신청자)
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { api } from '../../api';
import { signup } from '../../auth';
import { MarkdownView } from '../../markdown';
import { site } from '../../site';

const router = useRouter();
const form = ref({ username: '', password: '', passwordConfirm: '', contact: '', agree: false });
const notice = ref(null);
const error = ref('');
const loading = ref(false);

const USERNAME_RE = /^[A-Za-z0-9_]{4,20}$/;
const usernameInvalid = computed(() => !!form.value.username && !USERNAME_RE.test(form.value.username));
const passwordMismatch = computed(() => !!form.value.passwordConfirm && form.value.password !== form.value.passwordConfirm);

onMounted(async () => {
  try {
    notice.value = (await api('/auth/signup-info')).notice;
  } catch {
    notice.value = '';
  }
});

async function submit() {
  error.value = '';
  if (passwordMismatch.value) { error.value = '비밀번호 확인이 일치하지 않습니다.'; return; }
  if (!form.value.agree) { error.value = '가입 안내에 동의해주세요.'; return; }
  loading.value = true;
  try {
    const { username, password, contact, agree } = form.value;
    await signup({ username, password, contact, agree });
    router.push('/mypage');
  } catch (e) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <section class="card signup-card">
    <RouterLink v-if="site.private" to="/login" class="muted">← 로그인으로</RouterLink>
    <h1>회원가입</h1>

    <!-- 가입 안내(주의문구): 관리 → 사이트 설정에서 작성 -->
    <div v-if="notice" class="signup-notice">
      <MarkdownView :source="notice" />
    </div>

    <form class="form" @submit.prevent="submit">
      <label>
        아이디 <span class="muted">(영문·숫자·_ 4~20자, 가입 후 바꿀 수 없음)</span>
        <input v-model="form.username" required minlength="4" maxlength="20" autocomplete="username"
          autocapitalize="off" spellcheck="false" :class="{ invalid: usernameInvalid }" />
        <span v-if="usernameInvalid" class="error">영문·숫자·_ 로 4~20자여야 합니다.</span>
      </label>
      <label>
        비밀번호 <span class="muted">(8자 이상)</span>
        <input v-model="form.password" type="password" required minlength="8" maxlength="100" autocomplete="new-password" />
      </label>
      <label>
        비밀번호 확인
        <input v-model="form.passwordConfirm" type="password" required minlength="8" maxlength="100" autocomplete="new-password"
          :class="{ invalid: passwordMismatch }" />
        <span v-if="passwordMismatch" class="error">비밀번호가 일치하지 않습니다.</span>
      </label>
      <label>
        소통 계정 <span class="muted">(예: 트위터 @아이디, 디스코드 아이디 — 운영진이 연락할 때 사용)</span>
        <input v-model="form.contact" required maxlength="100" />
      </label>

      <label class="inline agree">
        <input v-model="form.agree" type="checkbox" />
        {{ notice ? '위 안내를 모두 읽었으며 동의합니다.' : '가입에 동의합니다.' }}
      </label>

      <p v-if="error" class="error">{{ error }}</p>
      <button type="submit" :disabled="loading || !form.agree">{{ loading ? '가입 중…' : '회원가입' }}</button>
      <p class="muted">가입하면 마이페이지에서 캐릭터를 작성할 수 있습니다.</p>
    </form>
    <p class="muted">이미 계정이 있나요? <RouterLink to="/login">로그인</RouterLink></p>
  </section>
</template>
