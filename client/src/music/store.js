// 음악 상태 — 어떤 곡을 틀지(우선순위) + 계정별 볼륨/정지 설정
//
// 우선순위: 나중에 등록된 레이어(프로필 > 페이지) → 없으면 사이트 전체 음악 → 없으면 재생 안 함
import { reactive, computed, watch, onBeforeUnmount, toValue } from 'vue';
import { api } from '../api';
import { auth } from '../auth';

const STORAGE_KEY = 'projectq.music';   // 비로그인 사용자 설정 저장

export const music = reactive({
  siteTrack: null,     // 사이트 전체 음악 (유튜브 영상 ID)
  layers: [],          // [{ key, source }] 페이지·프로필 음악 — 뒤에 있을수록 우선
  volume: 50,          // 0~100
  enabled: true,       // false = 정지
  blocked: false,      // 브라우저가 자동 재생을 막음 → 클릭하면 재생
  title: '',           // 재생 중인 곡 제목
  error: '',
});

// 지금 틀어야 할 곡 (영상 ID 또는 null)
export const currentTrack = computed(() => {
  for (let i = music.layers.length - 1; i >= 0; i -= 1) {
    const id = toValue(music.layers[i].source);
    if (id) return id;
  }
  return music.siteTrack || null;
});

// ---------- 곡 지정 ----------

// 사이트 전체 음악 (관리자 설정값, App 시작 시 불러옴)
export function setSiteMusic(videoId) {
  music.siteTrack = videoId || null;
}

let layerSeq = 0;

// 페이지/컴포넌트 음악: 이 컴포넌트가 화면에 있는 동안만 재생, 사라지면 이전 곡으로
//   usePageMusic('dQw4w9WgXcQ')                       고정 곡
//   usePageMusic(() => selectedProfile.value?.musicVideoId)   바뀌는 곡 (없으면 아래 레이어/사이트 음악)
export function usePageMusic(source) {
  const key = ++layerSeq;
  music.layers.push({ key, source });
  onBeforeUnmount(() => {
    const i = music.layers.findIndex((l) => l.key === key);
    if (i >= 0) music.layers.splice(i, 1);
  });
}

// ---------- 볼륨 / 정지 (계정 단위 저장) ----------

let saveTimer = null;
function persist() {
  const prefs = { musicVolume: music.volume, musicEnabled: music.enabled };
  if (!auth.user) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs)); } catch { /* 저장 불가 환경 무시 */ }
    return;
  }
  // 볼륨 슬라이더를 움직이는 동안 요청이 몰리지 않게 잠깐 모았다가 저장
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    try {
      const { user } = await api('/auth/me/preferences', { method: 'PUT', body: prefs });
      Object.assign(auth.user, { musicVolume: user.musicVolume, musicEnabled: user.musicEnabled });
    } catch { /* 저장 실패해도 재생에는 영향 없음 */ }
  }, 500);
}

export function setVolume(value) {
  music.volume = Math.min(100, Math.max(0, Math.round(Number(value) || 0)));
  persist();
}

export function setEnabled(value) {
  music.enabled = !!value;
  persist();
}

export const toggleMusic = () => setEnabled(!music.enabled);

// 로그인 상태가 바뀌면 그 계정의 설정(없으면 브라우저 저장값)을 불러옴
function loadPrefs(user) {
  let prefs = null;
  if (user) {
    prefs = { musicVolume: user.musicVolume, musicEnabled: user.musicEnabled };
  } else {
    try { prefs = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); } catch { prefs = null; }
  }
  if (prefs && Number.isFinite(prefs.musicVolume)) music.volume = prefs.musicVolume;
  if (prefs && typeof prefs.musicEnabled === 'boolean') music.enabled = prefs.musicEnabled;
}

watch(() => auth.user?.id ?? null, () => loadPrefs(auth.user), { immediate: true });
