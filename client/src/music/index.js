// 음악 모듈 — 어디서든 이 폴더만 import 해서 사용 (사용법: music/README.md)
//
//   import { usePageMusic, setSiteMusic, music, setVolume, toggleMusic, parseYouTubeId } from '../music';
//
//   usePageMusic('dQw4w9WgXcQ')   이 페이지(컴포넌트)에 있는 동안만 이 곡 재생
//   setSiteMusic('dQw4w9WgXcQ')   사이트 전체 음악 (보통 관리자 설정값을 App 에서 지정)
//
// <MusicPlayer /> 는 App.vue 에 한 번만 둡니다 (재생 + 화면 오른쪽 아래 컨트롤)
export {
  music, currentTrack, setSiteMusic, usePageMusic, setVolume, setEnabled, toggleMusic,
} from './store';
export { parseYouTubeId, youtubeUrl } from './youtube';
export { default as MusicPlayer } from './MusicPlayer.vue';
