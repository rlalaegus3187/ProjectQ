<script setup>
// 음악 플레이어 — App.vue 에 한 번만 둠. 페이지가 바뀌어도(SPA) 끊기지 않고 계속 재생
// 어떤 곡을 틀지는 store(currentTrack)가 정하고, 여기서는 유튜브 플레이어만 조작
import { ref, watch, onMounted, onBeforeUnmount } from 'vue';
import { loadYouTubeApi, youtubeUrl } from './youtube';
import { music, currentTrack, setVolume, toggleMusic } from './store';

const host = ref(null);          // 유튜브 iframe 이 들어갈 자리
const showVideo = ref(false);    // 영상 보기 (유튜브 정책상 플레이어는 최소 200x200)
let player = null;
let creating = false;   // 플레이어를 두 번 만들지 않도록
let ready = false;
let loadedTrack = null;
let blockTimer = null;

const STATE = { ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3, CUED: 5 };

// 자동 재생이 막혔는지 확인: 재생을 요청했는데 잠시 뒤에도 재생 중이 아니면 → 클릭 필요
function checkBlocked() {
  clearTimeout(blockTimer);
  blockTimer = setTimeout(() => {
    if (!player || !music.enabled || !currentTrack.value) return;
    const s = player.getPlayerState?.();
    music.blocked = s !== STATE.PLAYING && s !== STATE.BUFFERING;
  }, 2000);
}

function play() {
  if (!ready) return;
  player.unMute();
  player.setVolume(music.volume);
  player.playVideo();
  checkBlocked();
}

// 곡/재생 여부가 바뀔 때 플레이어에 반영
function sync() {
  if (!ready) return;
  const track = currentTrack.value;
  if (!track) {
    player.stopVideo();
    loadedTrack = null;
    music.title = '';
    music.blocked = false;
    return;
  }
  if (track !== loadedTrack) {
    loadedTrack = track;
    music.title = '';
    music.error = '';
    if (music.enabled) {
      player.loadVideoById(track);   // 불러오면서 바로 재생
      checkBlocked();
    } else {
      player.cueVideoById(track);    // 정지 상태: 준비만
    }
    return;
  }
  if (music.enabled) play();
  else player.pauseVideo();
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
          player.setVolume(music.volume);
          sync();
        },
        onStateChange: (e) => {
          if (e.data === STATE.PLAYING) {
            music.blocked = false;
            music.title = player.getVideoData?.().title || '';
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
watch(() => music.volume, (v) => { if (ready) player.setVolume(v); });

onMounted(() => {
  ensurePlayer();
  document.addEventListener('pointerdown', onFirstGesture, true);
  document.addEventListener('keydown', onFirstGesture, true);
});
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onFirstGesture, true);
  document.removeEventListener('keydown', onFirstGesture, true);
  clearTimeout(blockTimer);
  player?.destroy?.();
});
</script>

<template>
  <div class="music-player" :class="{ hidden: !currentTrack, 'video-open': showVideo }" aria-label="음악 플레이어">
    <!-- 유튜브 플레이어: 평소엔 화면 밖, [영상] 누르면 표시 -->
    <div class="music-video"><div ref="host" /></div>

    <div v-if="currentTrack" class="music-bar">
      <button type="button" class="music-btn" :title="music.enabled ? '정지' : '재생'" :aria-label="music.enabled ? '음악 정지' : '음악 재생'"
        @click="music.blocked && music.enabled ? play() : toggleMusic()">
        {{ music.enabled && !music.blocked ? '❚❚' : '▶' }}
      </button>
      <span class="music-title" :title="music.title">
        <template v-if="music.error">{{ music.error }}</template>
        <template v-else-if="music.blocked && music.enabled">클릭하면 음악이 재생됩니다</template>
        <template v-else-if="!music.enabled">음악 정지됨</template>
        <template v-else>♪ {{ music.title || '재생 중…' }}</template>
      </span>
      <input class="music-volume" type="range" min="0" max="100" step="1" :value="music.volume" aria-label="볼륨"
        :title="`볼륨 ${music.volume}`" @input="setVolume($event.target.value)" />
      <button type="button" class="music-btn small" :title="showVideo ? '영상 닫기' : '영상 보기'" @click="showVideo = !showVideo">
        {{ showVideo ? '✕' : '영상' }}
      </button>
      <a class="music-btn small" :href="youtubeUrl(currentTrack)" target="_blank" rel="noopener noreferrer" title="유튜브에서 보기">↗</a>
    </div>
  </div>
</template>
