# music/ — 음악(유튜브) 재생 모듈

화면 오른쪽 아래 플레이어 1개로 사이트 전체 음악 / 페이지 음악 / 프로필 음악을 재생합니다.
SPA 라서 페이지를 옮겨도 음악이 끊기지 않고, 곡만 바뀝니다.

```js
import { usePageMusic, setSiteMusic, music, setVolume, toggleMusic, parseYouTubeId } from '../music';
```

## 어떤 곡이 재생되나 (우선순위)
1. **나중에 등록된 레이어** — 프로필 음악(보고 있는 프로필) > 페이지 음악
2. 없으면 **사이트 전체 음악** (관리 → 사이트 설정)
3. 그것도 없으면 재생 안 함 (플레이어 숨김)

레이어의 곡이 비어 있으면(예: 음악 없는 프로필) 아래 단계 곡이 재생됩니다.

## 특정 페이지에서만 다른 음악
페이지 컴포넌트의 `<script setup>` 에 한 줄:

```vue
<script setup>
import { usePageMusic } from '../../music';
usePageMusic('dQw4w9WgXcQ');                 // 유튜브 영상 ID (또는 parseYouTubeId('https://youtu.be/...'))
</script>
```

이 페이지를 떠나면 자동으로 이전 곡(사이트 음악 등)으로 돌아갑니다.
바뀌는 값이면 함수로: `usePageMusic(() => selected.value?.musicVideoId)`

**router.js 에서 지정해도 됩니다:**
```js
{ path: '/world', component: ..., meta: { music: 'dQw4w9WgXcQ' } }
```

## 사이트 전체 음악
관리 → **사이트 설정**에서 유튜브 링크 입력. 코드에서 바꾸려면 `setSiteMusic('영상ID')`.

## 볼륨 / 정지 (계정 단위 저장)
플레이어의 ❚❚/▶ 버튼과 볼륨 슬라이더. 로그인한 회원은 계정에 저장(`users.music_volume`, `music_enabled`),
비로그인은 브라우저에 저장. 코드에서: `setVolume(0~100)`, `setEnabled(true/false)`, `toggleMusic()`.
현재 상태는 `music.volume`, `music.enabled`, `music.title`.

## 알아둘 점
- 브라우저는 사용자가 한 번도 클릭하지 않은 페이지에서 소리 있는 자동 재생을 막습니다.
  이때 플레이어에 "클릭하면 음악이 재생됩니다"가 뜨고, 페이지 아무 곳이나 클릭하면 재생됩니다.
- 퍼가기(임베드) 금지 영상, 비공개/삭제 영상은 재생되지 않고 플레이어에 안내가 뜹니다.
- 유튜브 정책상 플레이어 영상은 [영상] 버튼으로 볼 수 있습니다(평소엔 숨김).

## 파일
| 파일 | 역할 |
|---|---|
| `store.js` | 곡 우선순위(`currentTrack`), `usePageMusic`, `setSiteMusic`, 볼륨/정지 + 저장 |
| `MusicPlayer.vue` | 유튜브 플레이어 + 오른쪽 아래 컨트롤 (App.vue 에 한 번만) |
| `youtube.js` | 유튜브 IFrame API 로더, 링크 → 영상 ID |
