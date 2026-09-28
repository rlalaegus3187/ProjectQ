<script setup>
// 관리자: 사이트 설정 — 사이트 전체 음악
import { ref, onMounted } from 'vue';
import { api } from '../api';
import { parseYouTubeId, setSiteMusic, youtubeUrl } from '../music';
import AdminNav from '../components/AdminNav.vue';

const siteMusic = ref('');
const saved = ref(null);
const error = ref('');
const message = ref('');

async function load() {
  const s = await api('/admin/settings');
  saved.value = s.siteMusic;
  siteMusic.value = youtubeUrl(s.siteMusic);
}

async function save() {
  error.value = '';
  message.value = '';
  try {
    const s = await api('/admin/settings', { method: 'PUT', body: { siteMusic: siteMusic.value } });
    saved.value = s.siteMusic;
    siteMusic.value = youtubeUrl(s.siteMusic);
    setSiteMusic(s.siteMusic);   // 지금 화면에도 바로 반영
    message.value = s.siteMusic ? '사이트 음악을 저장했습니다.' : '사이트 음악을 껐습니다.';
  } catch (e) {
    error.value = e.message;
  }
}

onMounted(() => load().catch((e) => { error.value = e.message; }));
</script>

<template>
  <AdminNav />
  <section class="card">
    <h1>사이트 설정</h1>
    <form class="form" @submit.prevent="save">
      <label class="field">
        <span>사이트 전체 음악 <span class="muted">(유튜브 링크, 비우면 끔)</span></span>
        <input v-model="siteMusic" type="url" maxlength="300" placeholder="https://www.youtube.com/watch?v=…" />
      </label>
      <p v-if="siteMusic && !parseYouTubeId(siteMusic)" class="error">유튜브 영상 링크가 아닙니다.</p>
      <p class="muted">
        모든 페이지에서 재생됩니다. 페이지·프로필에 따로 지정된 음악이 있으면 그 음악이 우선합니다.
        볼륨과 정지는 각 회원이 화면 오른쪽 아래 플레이어에서 조절합니다(계정마다 저장).
      </p>
      <p v-if="error" class="error">{{ error }}</p>
      <p v-if="message" class="ok">{{ message }}</p>
      <div class="actions">
        <button type="submit">저장</button>
      </div>
    </form>
  </section>
</template>
