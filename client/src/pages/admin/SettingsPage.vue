<script setup>
// 관리자: 사이트 설정 — 사이트 이름·아이콘(상단 로고, 브라우저 탭), 사이트 전체 음악
import { ref, computed, onMounted } from 'vue';
import { api } from '../../api';
import { parseYouTubeId, setSiteMusic, youtubeUrl } from '../../music';
import { setSite, isImageIcon } from '../../site';
import ImageField from '../../components/ImageField.vue';

const EMOJI_PICKS = ['⭐', '🌙', '🔥', '🗡️', '🛡️', '🐉', '🌸', '🍀', '💎', '🎲', '📜', '🏰'];

const form = ref(null);   // { siteName, iconType: none|emoji|image, emoji, image, siteMusic }
const error = ref('');
const message = ref('');
const saving = ref(false);

const icon = computed(() => {
  if (!form.value) return null;
  if (form.value.iconType === 'emoji') return form.value.emoji.trim() || null;
  if (form.value.iconType === 'image') return form.value.image || null;
  return null;
});
const musicInvalid = computed(() => !!form.value?.siteMusic && !parseYouTubeId(form.value.siteMusic));

function toForm(s) {
  const image = isImageIcon(s.siteIcon);
  return {
    siteName: s.siteName,
    iconType: !s.siteIcon ? 'none' : image ? 'image' : 'emoji',
    emoji: s.siteIcon && !image ? s.siteIcon : '',
    image: image ? s.siteIcon : '',
    siteMusic: youtubeUrl(s.siteMusic),
  };
}

async function save() {
  error.value = '';
  message.value = '';
  if (form.value.iconType !== 'none' && !icon.value) {
    error.value = form.value.iconType === 'emoji' ? '이모지를 입력하거나 "없음"을 골라주세요.' : '이미지를 올리거나 "없음"을 골라주세요.';
    return;
  }
  saving.value = true;
  try {
    const s = await api('/admin/settings', {
      method: 'PUT',
      body: { siteName: form.value.siteName, siteIcon: icon.value ?? '', siteMusic: form.value.siteMusic },
    });
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
        <legend>사이트 이름 · 아이콘</legend>
        <label class="field">
          사이트 이름 <span class="muted">(상단 로고, 브라우저 탭 제목)</span>
          <input v-model="form.siteName" required maxlength="30" />
        </label>

        <div class="field">
          <span>아이콘 <span class="muted">(사이트 이름 옆, 브라우저 탭)</span></span>
          <div class="icon-choices">
            <label class="inline"><input v-model="form.iconType" type="radio" value="none" /> 없음</label>
            <label class="inline"><input v-model="form.iconType" type="radio" value="emoji" /> 이모지</label>
            <label class="inline"><input v-model="form.iconType" type="radio" value="image" /> 이미지</label>
          </div>
        </div>

        <div v-if="form.iconType === 'emoji'" class="field">
          <input v-model="form.emoji" class="emoji-input" maxlength="16" placeholder="⭐" aria-label="이모지" />
          <div class="emoji-picks">
            <button v-for="e in EMOJI_PICKS" :key="e" type="button" :title="e" @click="form.emoji = e">{{ e }}</button>
          </div>
          <span class="muted">다른 이모지는 Windows <kbd>Win</kbd>+<kbd>.</kbd> / Mac <kbd>Ctrl</kbd>+<kbd>Cmd</kbd>+<kbd>Space</kbd> 로 입력</span>
        </div>
        <div v-else-if="form.iconType === 'image'" class="field">
          <ImageField v-model="form.image" alt="사이트 아이콘" />
          <span class="muted">정사각형 이미지를 권장합니다 (예: 64×64, 투명 배경 png)</span>
        </div>

        <div class="site-preview" aria-label="미리보기">
          <span class="muted">미리보기</span>
          <span class="tab">
            <img v-if="icon && isImageIcon(icon)" :src="icon" alt="" />
            <span v-else-if="icon">{{ icon }}</span>
            {{ form.siteName || '사이트 이름' }}
          </span>
          <span class="brand">
            <template v-if="icon">
              <img v-if="isImageIcon(icon)" :src="icon" alt="" class="brand-icon" />
              <span v-else class="brand-icon">{{ icon }}</span>
            </template>
            {{ form.siteName || '사이트 이름' }}
          </span>
        </div>
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
