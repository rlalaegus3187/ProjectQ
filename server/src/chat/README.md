# 채팅 (Socket.IO) — 기본 틀 + 모듈

실시간 채팅방입니다. **기본 기능(코어)** 위에 **모듈**을 파일로 붙여서 기능을 늘리는 구조입니다.
코어는 그대로 두고 모듈만 추가·삭제하면 되므로, 다른 사이트에 복사해 써도 기본 기능이 깨지지 않습니다.

## 들어 있는 것
| 위치 | 하는 일 |
|---|---|
| `server/src/chat/index.js` | 코어 — 로그인 확인, 방 만들기·가입·나가기·삭제, 입장·기록·메시지·삭제, 접속자, 입력 중 표시, 도배 방지, 모듈 불러오기 |
| `server/src/chat/spaces.js` | **공간(roomspace) 목록** — 공간마다 네임스페이스 `/<이름>` 하나 (지금은 `chat`, 나중에 조사 전용 등) |
| `server/src/chat/store.js` | DB 처리 (`chat_rooms`, `chat_room_members`, `chat_messages`) |
| `server/src/chat/modules/*.js` | **서버 모듈** — 파일을 넣으면 자동으로 붙음 (`_` 로 시작하면 건너뜀) |
| `server/src/routes/chat.js` | REST: 방 목록, 관리자 방 관리 |
| `client/src/chat/socket.js` | 소켓 연결 · `request(이벤트, 값)` |
| `client/src/chat/ChatMessage.vue` | 메시지 한 줄 (종류별 화면이 있으면 그걸로) |
| `client/src/chat/modules/*.js` | **화면 모듈** — 서버 모듈이 만든 메시지 종류(type)를 어떻게 그릴지 |
| `client/src/pages/chat/ChatPage.vue` | 채팅 화면 `/chat` |
| `client/src/pages/admin/ChatAdminPage.vue` | 관리 → 채팅 관리 (켜기/끄기, 방 관리, 연결 정보) |

기본 기능: 방 목록(내 방 · 다른 방) · **방 만들기**(번호 자동, 만든 사람이 방장·자동 가입, 회원당 5개) · **가입 / 나가기** ·
마지막 사람이 나가면 **방 폭파**(기록·가입 함께 삭제) · 방장이 나가면 가장 먼저 들어온 사람이 방장 · 삭제(방장·관리자) ·
가입한 방만 입장 — **최신 20개만** 받고 위로 스크롤해 맨 위에 닿으면 이전 20개씩 · 보내기(Enter / Shift+Enter 줄바꿈) ·
**표정(두상)** 골라 말하기 · **글자 꾸미기**(마크다운) · 내 메시지 **고치기**(내용·표정) · 내 메시지 삭제(관리자는 모두) · 가입자 목록(지금 보고 있는 사람 표시) · 입력 중 표시 · 도배 방지(5초에 5개) · `/도움말` ·
관리자: 상시 방 추가/수정/닫기/관리자 전용/기록 비우기, 회원 방 삭제, 채팅 끄기

### 방 종류
| 종류 | 만드는 곳 | 비면 |
|---|---|---|
| 상시 방 (`is_permanent=1`) | 관리 → 채팅 관리 | 남음 |
| 회원 방 | 채팅 화면 [+ 방 만들기] | 폭파 (계정 삭제로 비어도) |

어느 방이든 **가입한 사람만** 들어가 대화합니다. 방 하나 = 소켓 room `room:<번호>`.

### 표정(두상) · 글자 꾸미기 · 고치기
- **표정**: 마이페이지 → 프로필 [수정] → 두상 칸 아래 **채팅용 두상**에 프로필마다 여러 개 등록 (`character_faces.profile_id`, 코드 `<캐릭터 id>_<번호>` 자동, `server/src/faces.js`).
  채팅에서는 **대표 프로필**의 두상 목록에서 고름 (대표 프로필을 바꾸면 고르는 목록도 바뀜).
  입력칸 옆 [표정]에서 고르고 보내면 메시지에 `face_id` 로 저장 → 기록을 불러올 때 그 표정 이미지를 찾아 붙임 (`message.face { id, code, name, image }`).
  표정을 지우면 그 메시지들은 두상만 기본 모양(이름 첫 글자). 고른 표정은 브라우저에 기억.
- **글 꾸미기**: 사이트 전체와 **같은 마크다운** — 툴바(`client/src/markdown/MarkdownToolbar.vue`)·문법·표시(`renderMarkdown`)가 글·페이지·프로필과 똑같음.
  제목 · 굵게 · 기울임 · 취소선 · `==형광펜==` · `-# 작게` · 목록 · 인용 · 코드 · **링크** · **이미지 넣기(파일)** · **이미지 링크**. 채팅에서는 크기만 작게(이미지는 최대 360×280). 서버는 글자 그대로 저장.
- **고치기**: 내 일반 메시지만 [수정] → 내용·표정 변경, 모두에게 바로 반영(`message:updated`), '(수정됨)' 표시 (`edited_at`).

## 공간 (roomspace)
`server/src/chat/spaces.js` 에 한 줄 추가하면 새 네임스페이스가 생깁니다. 방(`chat_rooms.space`)·명령어·모듈이 공간마다 따로입니다.
```js
{ name: 'investigation', label: '조사', modulesDir: path.join(__dirname, 'investigation') },
```
- 화면: `getChatSocket('investigation')` · `request('room:enter', { roomId }, 'investigation')`
- 서버: `getChat('investigation')?.sendSystem(roomId, '...')`

## 새 모듈 만들기
### 1) 서버 모듈 — `server/src/chat/modules/<이름>.js`
`modules/_template.js` 를 복사해서 이름을 바꾸면 됩니다. 서버를 재시작하면(배포하면) 자동으로 붙습니다.

```js
module.exports = {
  name: 'attendance',
  description: '출석 체크',
  setup(chat) {
    // '/출석' 명령어 → 돌려준 메시지가 그 사람 이름으로 방에 올라감
    chat.command('출석', { aliases: ['check'], usage: '/출석', description: '오늘 출석' }, async ({ user, reply }) => {
      const [r] = await chat.pool.execute('INSERT IGNORE INTO attendance (user_id, day) VALUES (?, CURDATE())', [user.id]);
      if (!r.affectedRows) return reply('오늘은 이미 출석했습니다.');   // 나에게만 보이는 안내 (저장 안 됨)
      return { type: 'attendance', body: `${user.name} 님 출석!`, data: { day: new Date().toISOString().slice(0, 10) } };
    });
  },
};
```

### 2) 화면 모듈 (선택) — `client/src/chat/modules/<이름>.js`
서버 모듈이 새 `type` 의 메시지를 만들면, 화면 모듈로 모양을 정합니다. **없으면 `body` 글자가 그대로 보이므로** 서버 모듈만으로도 동작합니다.
```js
import AttendanceMessage from './AttendanceMessage.vue';   // props: message { id, type, author, body, data, createdAt }
export default { name: 'attendance', messageTypes: { attendance: AttendanceMessage } };
```
모양(CSS)은 `client/public/css/basic/pages/ChatPage.css` 에 추가합니다.

### 3) DB 가 필요하면
`db/migrations/NNN_<이름>.sql` 을 새로 만들면 배포할 때 자동으로 적용됩니다.

### 모듈 끄기
파일에 `enabled: false`, 또는 `server/.env` 에 `CHAT_MODULES_DISABLED=dice,attendance` (파일을 지우지 않고 끔)

## 모듈 API (`setup(chat)` 의 `chat`)
| 이름 | 설명 |
|---|---|
| `chat.command(이름, { aliases, usage, description }, fn)` | `/이름 ...` 명령어. `fn(ctx)` 가 `{ type, body, data }` 를 돌려주면 방에 올라감, 안 돌려주면 아무것도 안 올라감 |
| `chat.beforeMessage(fn)` | 보내기 전: `fn(msg, ctx)` → 바꾼 `msg` / `null`(조용히 취소) / `throw new chat.HttpError(400, '이유')`(보낸 사람에게 오류) |
| `chat.afterMessage(fn)` | 저장·전송된 뒤: `fn(saved, ctx)` — 다른 기능 연동(포인트 지급, 기록 등). 여기서 난 오류는 로그만 남고 채팅은 계속 |
| `chat.onJoin(fn)` · `chat.onLeave(fn)` | 방 화면에 들어올 때 `{ user, room, socket }` / 나갈 때 `{ user, roomId, socket }` (가입·탈퇴가 아니라 입장·퇴장) |
| `chat.onConnection(fn)` | 접속할 때 `(socket, user)` — 모듈 전용 소켓 이벤트 추가: `socket.on('모듈이름:이벤트', (payload, ack) => ...)` |
| `chat.post(roomId, { user, type, body, data })` | 메시지 저장 + 방에 보내기 (`user` 없으면 이름 없는 메시지) |
| `chat.sendSystem(roomId, text)` | 시스템 메시지 (가운데 회색 글자) |
| `chat.notice(socket, text)` | 한 사람에게만 보이는 안내 (저장 안 됨) |
| `chat.usersIn(roomId)` | 그 방 접속자 `[{ id, name, role }]` |
| `chat.roomsChanged()` · `chat.roomDeleted(roomId, 이유)` | 방 목록 새로고침 / 방이 지워짐 → 들어와 있던 사람 내보냄 |
| `chat.space` · `chat.store` · `chat.pool` · `chat.nsp` · `chat.io` | 공간 이름 · DB 함수 · DB 커넥션 풀 · Socket.IO 네임스페이스(`/chat`) · 서버 |

`ctx = { user: { id, username, name(캐릭터 이름 없으면 아이디), role, isAdmin }, room, socket, faceId(고른 표정), reply(text), args, argText }`
(명령어가 돌려준 메시지도 고른 표정으로 올라감 — 바꾸려면 `{ faceId: null, ... }`)

### 사이트의 다른 기능에서 채팅으로 보내기
```js
const { getChat } = require('../chat');
await getChat()?.sendSystem(1, '이벤트가 시작되었습니다!');   // 1 = 방 번호
```

## 소켓 이벤트 (화면 ↔ 서버)
| 보내기 (화면 → 서버, ack 로 `{ ok, ... }` / `{ error }`) | 받기 (서버 → 화면) |
|---|---|
| `rooms:list` → `{ rooms }` | `message:new` 새 메시지 |
| `room:create { name, description }` → `{ room }` | `message:deleted { id, roomId }` |
| `room:join { roomId }` → `{ room }` (가입) | `message:notice { text }` (나에게만) |
| `room:leave { roomId }` → `{ destroyed }` | `room:users { roomId, users }` (보고 있는 사람) |
| `room:delete { roomId }` | `room:members { roomId, members }` (가입자) |
| `room:enter { roomId }` → `{ room, messages, hasMore, users, members, commands }` | `typing { roomId, userId, name }` |
| `room:history { roomId, beforeId }` → `{ messages, hasMore }` | `rooms:changed` (목록 다시 불러오기) |
| `message:send { roomId, text, faceId }` · `message:edit { messageId, text, faceId }` | `room:closed { roomId, reason }` (방이 사라짐·내가 나감) |
| `message:delete { messageId }` · `typing { roomId }` | `message:updated { ...메시지 }` (누가 고침) |

## 누가 쓸 수 있나
- 로그인한 **멤버·관리자** (`index.js` 의 `CHAT_ROLES` — 신청자도 쓰게 하려면 `'applicant'` 추가)
- 관리 → 채팅 관리에서 **끄면** 관리자만 (상단 메뉴의 '채팅'도 빠짐), 사이트 비공개 모드도 관리자만
- 메시지마다 권한을 다시 확인 → 권한 변경·탈퇴·채팅 끄기가 바로 반영

## 배포 · 포트
- **포트**: `.env` 의 `CHAT_PORT` (없거나 `PORT` 와 같으면 API 와 같은 포트·같은 프로세스). 다르면 `src/chatServer.js` 가 따로 뜨고,
  API 쪽의 `getChat()` 은 내부 통로(`chat/bridge.js`, 127.0.0.1 + 비밀 토큰)로 `sendSystem` · `roomsChanged` · `stats` 를 전달합니다.
  → 모듈 API(`command`, `beforeMessage` ...)는 채팅 프로세스 안에서만 쓰는 것이라, 따로 띄워도 모듈 코드는 그대로입니다.
- 관리 → 커뮤니티 설정 → 서버 포트에서 지금 포트를 볼 수 있습니다 (바꾸는 건 `.env` + `node /data/deploy.js`)
- 주소는 늘 `/api/socket.io` — 브라우저는 지금 보고 있는 사이트로만 연결하므로 다른 사이트와 섞이지 않음
- Nginx: 배포(`deploy.js`) 때 `deploy/apply-ports.sh` 가 `/api/socket.io/` 를 채팅 포트로 연결하고 웹소켓을 허용
- npm 패키지: 서버 `socket.io`, 화면 `socket.io-client` — `package.json` 에 들어 있어 `deploy.js` 의 `npm ci` 가 설치. 직접 설치는
  `npm --prefix server install socket.io` · `npm --prefix client install socket.io-client`
- 채팅 프로세스는 1개(`instances: 1`)로 — 접속자·방 정보가 프로세스 메모리에 있음. 여러 개로 늘리려면 `@socket.io/redis-adapter` 필요
