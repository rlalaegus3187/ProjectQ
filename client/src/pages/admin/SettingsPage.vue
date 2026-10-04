<script setup>
// 관리자: 사이트 설정 — 사이트 공개 상태(회원 전용), 사이트 이름(상단 로고, 브라우저 탭 제목), 파비콘(브라우저 탭 아이콘), Q&A 비회원 글쓰기, 사이트 전체 음악
import { ref, computed, onMounted } from 'vue';
import { api } from '../../api';
import { parseYouTubeId, setSiteMusic, youtubeUrl } from '../../music';
import { setSite } from '../../site';
import ImageField from '../../components/ImageField.vue';
import { MarkdownEditor } from '../../markdown';

const form = ref(null);   // { sitePrivate, siteName, siteFavicon, signupNotice, qnaGuestWrite, siteMusic }
const error = ref('');
const message = ref('');
const saving = ref(false);

const musicInvalid = computed(() => !!form.value?.siteMusic && !parseYouTubeId(form.value.siteMusic));

const toForm = (s) => ({
  sitePrivate: !!s.sitePrivate,
  signupOpen: s.signupOpen !== false,
  signupNotice: s.signupNotice || '',
  siteName: s.siteName, siteFavicon: s.siteFavicon || '', qnaGuestWrite: !!s.qnaGuestWrite, siteMusic: youtubeUrl(s.siteMusic),
});

async function save() {
  error.value = '';
  message.value = '';
  saving.value = true;
  try {
    const s = await api('/admin/settings', { method: 'PUT', body: form.value });
    form.value = toForm(s);
    setSite(s);                 // 상단 로고·브라우저 탭에 바로 반영
    setSiteMusic(s.siteMusic);
    message.value = '저장했습니다.';
  } catch (e) {
    error.value = e.message;
  } finally {
    saving.value = false;
  }
}

onMounted(async () => {
  try {
    form.value = toForm(await api('/admin/settings'));
  } catch (e) {
    error.value = e.message;
  }
});
</script>

<template>
  <section class="card">
    <h1>사이트 설정</h1>
    <p v-if="!form && !error" class="muted">불러오는 중…</p>
    <form v-else-if="form" class="form" @submit.prevent="save">
      <fieldset class="fieldset stack">
        <legend>사이트 공개 · 회원가입</legend>
        <label class="switch-row">
          <span class="switch">
            <input v-model="form.sitePrivate" type="checkbox" role="switch" :aria-checked="form.sitePrivate" />
            <span class="slider" />
          </span>
          <span>
            회원 전용 <strong :class="form.sitePrivate ? 'on' : 'off'">{{ form.sitePrivate ? '켜짐 (클로즈)' : '꺼짐 (오픈)' }}</strong>
            <span class="muted">— 켜면 로그인해야 메인 페이지를 포함한 모든 화면을 볼 수 있고, 로그인하지 않은 방문자에게는 로그인 화면만 보입니다.
              회원가입은 아래 '회원가입' 스위치를 따릅니다. Q&amp;A 비회원 글쓰기도 함께 막힙니다.</span>
          </span>
        </label>
        <label class="switch-row">
          <span class="switch">
            <input v-model="form.signupOpen" type="checkbox" role="switch" :aria-checked="form.signupOpen" />
            <span class="slider" />
          </span>
          <span>
            회원가입 <strong :class="form.signupOpen ? 'on' : 'off'">{{ form.signupOpen ? '허용' : '막음' }}</strong>
            <span class="muted">— 끄면 회원가입 화면에 "지금은 회원가입을 받지 않습니다"가 보이고 가입 버튼·링크가 사라집니다. 이미 가입한 회원은 그대로 로그인할 수 있습니다.</span>
          </span>
        </label>
      </fieldset>

      <fieldset class="fieldset stack">
        <legend>사이트 이름 · 파비콘</legend>
        <label class="field">
          사이트 이름 <span class="muted">(상단 로고, 브라우저 탭 제목)</span>
          <input v-model="form.siteName" required maxlength="30" />
        </label>

        <div class="field">
          <span>파비콘 <span class="muted">(브라우저 탭에 보이는 작은 아이콘, 비우면 없음)</span></span>
          <ImageField v-model="form.siteFavicon" alt="파비콘"
            accept=".ico,image/x-icon,image/vnd.microsoft.icon,image/png,image/jpeg,image/gif,image/webp"
            hint="ico, png(권장: 32×32 또는 64×64 정사각형) · 5MB 이하" />
        </div>

        <div class="site-preview" aria-label="미리보기">
          <span class="muted">브라우저 탭 미리보기</span>
          <span class="tab">
            <img v-if="form.siteFavicon" :src="form.siteFavicon" alt="" />
            {{ form.siteName || '사이트 이름' }}
          </span>
        </div>
      </fieldset>

      <fieldset class="fieldset stack">
        <legend>회원가입 안내 (주의문구)</legend>
        <p class="muted">회원가입 화면 맨 위에 보이고, 가입하려면 아래 체크박스로 "동의합니다"를 눌러야 합니다. 비워두면 안내 없이 동의 체크만 보입니다.</p>
        <MarkdownEditor v-model="form.signupNotice" :rows="10" :maxlength="20000"
          placeholder="예: ## 가입 전 꼭 읽어주세요&#10;- 캐릭터 설정은 세계관을 따라주세요.&#10;- 소통 계정은 운영진 연락용입니다." />
      </fieldset>

      <fieldset class="fieldset stack">
        <legend>Q&amp;A</legend>
        <label class="switch-row">
          <span class="switch">
            <input v-model="form.qnaGuestWrite" type="checkbox" role="switch" :aria-checked="form.qnaGuestWrite" />
            <span class="slider" />
          </span>
          <span>
            비회원 글쓰기 <strong :class="form.qnaGuestWrite ? 'on' : 'off'">{{ form.qnaGuestWrite ? '켜짐' : '꺼짐' }}</strong>
            <span class="muted">— 켜면 로그인하지 않아도 이름·비밀번호로 Q&amp;A 질문을 남길 수 있습니다. 끄면 새 글만 막히고, 이미 쓴 비회원 글은 비밀번호로 계속 보기·수정·삭제할 수 있습니다.</span>
          </span>
        </label>
      </fieldset>

      <fieldset class="fieldset stack">
        <legend>사이트 음악</legend>
        <label class="field">
          <span>사이트 전체 음악 <span class="muted">(유튜브 링크, 비우면 끔)</span></span>
          <input v-model="form.siteMusic" type="url" maxlength="300" placeholder="https://www.youtube.com/watch?v=…" />
        </label>
        <p v-if="musicInvalid" class="error">유튜브 영상 링크가 아닙니다.</p>
        <p class="muted">
          모든 페이지에서 재생됩니다. 페이지·프로필에 따로 지정된 음악이 있으면 그 음악이 우선합니다.
          볼륨과 정지는 각 회원이 화면 오른쪽 아래 플레이어에서 조절합니다(계정마다 저장).
        </p>
      </fieldset>

      <p v-if="error" class="error">{{ error }}</p>
      <p v-if="message" class="ok">{{ message }}</p>
      <div class="actions">
        <button type="submit" :disabled="saving || musicInvalid">{{ saving ? '저장 중…' : '저장' }}</button>
      </div>
    </form>
    <p v-else class="error">{{ error }}</p>
  </section>
</template>
