<script setup>
// 음악 플레이어 — App.vue 에 한 번만 둠. 페이지가 바뀌어도(SPA) 끊기지 않고 계속 재생
// 어떤 곡을 틀지는 store(currentTrack)가 정하고, 여기서는 유튜브 플레이어만 조작
import { ref, watch, onMounted, onBeforeUnmount } from 'vue';
import { loadYouTubeApi } from './youtube';
import { music, currentTrack, setVolume, toggleMusic } from './store';

const host = ref(null);          // 유튜브 iframe 이 들어갈 자리
let player = null;
let creating = false;   // 플레이어를 두 번 만들지 않도록
let ready = false;
let loadedTrack = null;
let blockTimer = null;

const STATE = { ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3, CUED: 5 };

// ---------- 볼륨 페이드 (곡이 바뀔 때 뚝 끊기지 않게: 작아졌다가 → 다음 곡 → 커짐) ----------
const FADE_OUT_MS = 600;
const FADE_IN_MS = 1200;
let playerVolume = 0;      // 플레이어에 지금 설정된 볼륨 (페이드 중엔 music.volume 과 다름)
let fadeTimer = null;
let fadeToken = 0;         // 새 페이드가 시작되면 이전 페이드는 취소
let pendingFadeIn = false; // 재생이 실제로 시작되면 커지기 시작

function setPlayerVolume(v) {
  playerVolume = Math.max(0, Math.min(100, v));
  player.setVolume(Math.round(playerVolume));
}

// target: 숫자 또는 () => 숫자 (페이드 중에 볼륨을 바꿔도 따라감). 끝까지 가면 true, 취소되면 false
function fadeTo(target, ms) {
  const token = ++fadeToken;
  clearInterval(fadeTimer);
  const from = playerVolume;
  const goal = () => (typeof target === 'function' ? target() : target);
  const steps = Math.max(1, Math.round(ms / 40));
  let i = 0;
  return new Promise((resolve) => {
    if (!ready) { resolve(false); return; }
    fadeTimer = setInterval(() => {
      if (token !== fadeToken) { clearInterval(fadeTimer); resolve(false); return; }
      i += 1;
      const t = i / steps;
      setPlayerVolume(from + (goal() - from) * (t * (2 - t)));   // 부드럽게 (ease-out)
      if (i >= steps) {
        clearInterval(fadeTimer);
        fadeTimer = null;
        resolve(true);
      }
    }, 40);
  });
}
const cancelFade = () => { fadeToken += 1; clearInterval(fadeTimer); fadeTimer = null; };
const isPlaying = () => ready && [STATE.PLAYING, STATE.BUFFERING].includes(player.getPlayerState?.());
const fadeIn = () => fadeTo(() => music.volume, FADE_IN_MS);

// 자동 재생이 막혔는지 확인: 재생을 요청했는데 잠시 뒤에도 재생 중이 아니면 → 클릭 필요
function checkBlocked() {
  clearTimeout(blockTimer);
  blockTimer = setTimeout(() => {
    if (!player || !music.enabled || !currentTrack.value) return;
    const s = player.getPlayerState?.();
    music.blocked = s !== STATE.PLAYING && s !== STATE.BUFFERING;
  }, 2000);
}

// 작은 소리에서 시작해서 재생이 시작되면 커짐
function play() {
  if (!ready) return;
  cancelFade();
  player.unMute();
  setPlayerVolume(0);
  pendingFadeIn = true;
  player.playVideo();
  checkBlocked();
}

// 곡/재생 여부가 바뀔 때 플레이어에 반영 (바뀌는 도중에 또 바뀌면 마지막 것만 반영)
let syncToken = 0;
async function sync() {
  if (!ready) return;
  const token = ++syncToken;
  const track = currentTrack.value;

  if (!track) {                                   // 재생할 곡 없음 → 작아지며 멈춤
    if (isPlaying()) await fadeTo(0, FADE_OUT_MS);
    if (token !== syncToken) return;
    player.stopVideo();
    loadedTrack = null;
    music.title = '';
    music.blocked = false;
    return;
  }

  if (track !== loadedTrack) {                    // 다른 곡 → 작아졌다가 다음 곡을 작게 시작해서 커짐
    if (loadedTrack && isPlaying()) await fadeTo(0, FADE_OUT_MS);
    if (token !== syncToken) return;
    loadedTrack = track;
    music.title = '';
    music.error = '';
    cancelFade();
    setPlayerVolume(0);
    if (music.enabled) {
      pendingFadeIn = true;
      player.loadVideoById(track);   // 불러오면서 바로 재생
      checkBlocked();
    } else {
      player.cueVideoById(track);    // 정지 상태: 준비만
    }
    return;
  }

  if (music.enabled) {                            // 다시 재생 → 커지며 시작
    if (!isPlaying()) play();
  } else if (isPlaying()) {                       // 정지 → 작아지며 멈춤
    await fadeTo(0, FADE_OUT_MS);
    if (token !== syncToken) return;
    player.pauseVideo();
  }
}

async function ensurePlayer() {
  if (player || creating || !currentTrack.value) return;
  creating = true;
  try {
    const YT = await loadYouTubeApi();
    player = new YT.Player(host.value, {
      width: 200,
      height: 200,
      playerVars: { autoplay: 0, controls: 1, playsinline: 1, rel: 0 },
      events: {
        onReady: () => {
          ready = true;
          setPlayerVolume(0);
          sync();
        },
        onStateChange: (e) => {
          if (e.data === STATE.PLAYING) {
            music.blocked = false;
            music.title = player.getVideoData?.().title || '';
            if (pendingFadeIn) {
              pendingFadeIn = false;
              fadeIn();
            }
          }
          if (e.data === STATE.ENDED && music.enabled) {   // 한 곡 반복
            player.seekTo(0);
            player.playVideo();
          }
        },
        onError: () => {
          music.error = '재생할 수 없는 영상입니다. (삭제·비공개·퍼가기 금지 영상)';
          music.blocked = false;
        },
      },
    });
  } catch (e) {
    music.error = e.message;
  } finally {
    creating = false;
  }
}

// 첫 클릭/키 입력 때 막혀 있던 재생 시작 (브라우저 자동 재생 정책)
function onFirstGesture() {
  if (music.blocked && music.enabled) play();
}

watch([currentTrack, () => music.enabled], () => {
  if (!player) ensurePlayer();
  else sync();
});
// 볼륨 슬라이더: 페이드 중이면 페이드가 새 볼륨을 따라가고, 아니면 바로 반영
watch(() => music.volume, (v) => { if (ready && !fadeTimer && isPlaying()) setPlayerVolume(v); });

onMounted(() => {
  ensurePlayer();
  document.addEventListener('pointerdown', onFirstGesture, true);
  document.addEventListener('keydown', onFirstGesture, true);
});
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onFirstGesture, true);
  document.removeEventListener('keydown', onFirstGesture, true);
  clearTimeout(blockTimer);
  cancelFade();
  player?.destroy?.();
});
</script>

<template>
  <!-- 재생/정지 + 볼륨만 표시 (곡 이름·영상은 보여주지 않음) -->
  <div class="music-player" :class="{ hidden: !currentTrack }" aria-label="음악 플레이어">
    <!-- 유튜브 플레이어: 화면 밖에 둠 -->
    <div class="music-video"><div ref="host" /></div>

    <div v-if="currentTrack" class="music-bar">
      <!-- 자동 재생이 막혔거나(blocked) 정지 상태면 ▶, 재생 중이면 ❚❚. 재생 못 하는 영상이면 버튼에 마우스를 올려 이유 확인 -->
      <button type="button" class="music-btn" :class="{ failed: music.error }"
        :title="music.error || (music.enabled && !music.blocked ? '정지' : '재생')"
        :aria-label="music.enabled && !music.blocked ? '음악 정지' : '음악 재생'"
        @click="music.blocked && music.enabled ? play() : toggleMusic()">
        {{ music.enabled && !music.blocked ? '❚❚' : '▶' }}
      </button>
      <input class="music-volume" type="range" min="0" max="100" step="1" :value="music.volume" aria-label="볼륨"
        :title="`볼륨 ${music.volume}`" @input="setVolume($event.target.value)" />
    </div>
  </div>
</template>
