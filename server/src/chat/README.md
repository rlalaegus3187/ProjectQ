# 채팅 (Socket.IO) — 기본 틀 + 모듈

실시간 채팅방입니다. **기본 기능(코어)** 위에 **모듈**을 파일로 붙여서 기능을 늘리는 구조입니다.
코어는 그대로 두고 모듈만 추가·삭제하면 되므로, 다른 사이트에 복사해 써도 기본 기능이 깨지지 않습니다.

## 들어 있는 것
| 위치 | 하는 일 |
|---|---|
| `server/src/chat/index.js` | 코어 — 로그인 확인, 방 입장·기록·메시지·삭제, 접속자, 입력 중 표시, 도배 방지, 모듈 불러오기 |
| `server/src/chat/store.js` | DB 처리 (`chat_rooms`, `chat_messages`) |
| `server/src/chat/modules/*.js` | **서버 모듈** — 파일을 넣으면 자동으로 붙음 (`_` 로 시작하면 건너뜀) |
| `server/src/routes/chat.js` | REST: 방 목록, 관리자 방 관리 |
| `client/src/chat/socket.js` | 소켓 연결 · `request(이벤트, 값)` |
| `client/src/chat/ChatMessage.vue` | 메시지 한 줄 (종류별 화면이 있으면 그걸로) |
| `client/src/chat/modules/*.js` | **화면 모듈** — 서버 모듈이 만든 메시지 종류(type)를 어떻게 그릴지 |
| `client/src/pages/chat/ChatPage.vue` | 채팅 화면 `/chat` |
| `client/src/pages/admin/ChatAdminPage.vue` | 관리 → 채팅 관리 (켜기/끄기, 방 관리, 연결 정보) |

기본 기능: 방 목록 · 최근 50개 기록(+ 이전 대화 더 보기) · 보내기(Enter / Shift+Enter 줄바꿈) · 내 메시지 삭제(관리자는 모두) ·
접속자 목록 · 입력 중 표시 · 도배 방지(5초에 5개) · `/도움말` · 관리자: 방 추가/수정/닫기/관리자 전용/기록 비우기, 채팅 끄기

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
| `chat.onJoin(fn)` · `chat.onLeave(fn)` | 방에 들어올 때 `{ user, room, socket }` / 나갈 때 `{ user, roomId, socket }` |
| `chat.onConnection(fn)` | 접속할 때 `(socket, user)` — 모듈 전용 소켓 이벤트 추가: `socket.on('모듈이름:이벤트', (payload, ack) => ...)` |
| `chat.post(roomId, { user, type, body, data })` | 메시지 저장 + 방에 보내기 (`user` 없으면 이름 없는 메시지) |
| `chat.sendSystem(roomId, text)` | 시스템 메시지 (가운데 회색 글자) |
| `chat.notice(socket, text)` | 한 사람에게만 보이는 안내 (저장 안 됨) |
| `chat.usersIn(roomId)` | 그 방 접속자 `[{ id, name, role }]` |
| `chat.store` · `chat.pool` · `chat.nsp` · `chat.io` | DB 함수 · DB 커넥션 풀 · Socket.IO 네임스페이스(`/chat`) · 서버 |

`ctx = { user: { id, username, name(캐릭터 이름 없으면 아이디), role, isAdmin }, room, socket, reply(text), args, argText }`

### 사이트의 다른 기능에서 채팅으로 보내기
```js
const { getChat } = require('../chat');
await getChat()?.sendSystem(1, '이벤트가 시작되었습니다!');   // 1 = 방 번호
```

## 소켓 이벤트 (화면 ↔ 서버)
| 보내기 (화면 → 서버, ack 로 `{ ok, ... }` / `{ error }`) | 받기 (서버 → 화면) |
|---|---|
| `room:join { roomId }` → `{ room, messages, users, commands }` | `message:new` 새 메시지 |
| `room:history { roomId, beforeId }` → `{ messages }` | `message:deleted { id, roomId }` |
| `message:send { roomId, text }` | `message:notice { text }` (나에게만) |
| `message:delete { messageId }` | `room:users { roomId, users }` · `typing { roomId, userId, name }` |
| `typing { roomId }` (응답 없음) | `rooms:changed` (관리자가 방을 바꿈 → 목록 다시 불러오기) |

## 누가 쓸 수 있나
- 로그인한 **멤버·관리자** (`index.js` 의 `CHAT_ROLES` — 신청자도 쓰게 하려면 `'applicant'` 추가)
- 관리 → 채팅 관리에서 **끄면** 관리자만 (상단 메뉴의 '채팅'도 빠짐), 사이트 비공개 모드도 관리자만
- 메시지마다 권한을 다시 확인 → 권한 변경·탈퇴·채팅 끄기가 바로 반영

## 배포 · 포트
- **포트를 따로 쓰지 않습니다.** API 서버와 같은 포트(`server/.env` 의 `PORT`)·같은 로그인 세션을 쓰고, 주소는 `/api/socket.io` 입니다.
  → 사이트마다 `PORT` 만 다르면 채팅도 자동으로 나뉩니다. 소켓은 항상 지금 보고 있는 사이트 주소로 연결되므로 다른 사이트와 섞이지 않습니다.
- Nginx: 기존 `/api/` 프록시만으로도 동작(롱폴링). **웹소켓**까지 쓰려면 사이트마다 한 번 `bash deploy/setup-socketio.sh`
  (새 서버는 `setup-server.sh` 가 처음부터 넣어 둠, `deploy.js` 가 빠져 있으면 알려줌)
- npm 패키지: 서버 `socket.io`, 화면 `socket.io-client` — `package.json` 에 들어 있어 `deploy.js` 의 `npm ci` 가 설치. 직접 설치는
  `npm --prefix server install socket.io` · `npm --prefix client install socket.io-client`
- PM2 는 1개 프로세스(`instances: 1`)로 — 접속자·방 정보가 프로세스 메모리에 있음. 여러 개로 늘리려면 `@socket.io/redis-adapter` 필요
