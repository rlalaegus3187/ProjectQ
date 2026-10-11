// 새 채팅 모듈 빈 틀 — 이 파일을 복사해서 이름을 바꾸면(예: modules/attendance.js) 서버 재시작 때 자동으로 붙음
// (파일 이름이 _ 로 시작하면 불러오지 않음 → 이 틀은 실행되지 않음)
// 끄기: 파일에 enabled: false, 또는 server/.env 에 CHAT_MODULES_DISABLED=이름1,이름2
//
// chat (모듈 API) — 자세한 건 server/src/chat/README.md
//   chat.command(이름, { aliases, usage, description }, async (ctx) => { ... })   '/이름 ...' 명령어
//   chat.beforeMessage(async (msg, ctx) => msg | null)   보내기 전에 바꾸기·막기
//   chat.afterMessage(async (saved, ctx) => {})           저장·전송된 뒤 (다른 기능 연동)
//   chat.onJoin(async ({ user, room, socket }) => {}) · chat.onLeave(...) · chat.onConnection((socket, user) => {})
//   chat.post(roomId, { user, type, body, data }) · chat.sendSystem(roomId, text) · chat.notice(socket, text)
//   chat.store (DB 함수) · chat.pool (DB) · chat.nsp (Socket.IO 네임스페이스) · chat.HttpError
//   ctx = { user: { id, username, name, role, isAdmin }, room: { id, name, ... }, socket, reply(text) }
module.exports = {
  name: 'template',
  description: '모듈 설명',
  // enabled: false,
  setup(chat) {
    // 예) /안녕 → 방에 인사 메시지
    chat.command('안녕', { usage: '/안녕', description: '인사하기' }, ({ user }) => ({ body: `${user.name} 님이 손을 흔듭니다 👋` }));

    // 예) 금지어 막기
    // chat.beforeMessage((msg) => {
    //   if (msg.body?.includes('금지어')) throw new chat.HttpError(400, '쓸 수 없는 단어가 있습니다.');
    //   return msg;
    // });

    // 예) 다른 기능과 연동 — 메시지가 올라올 때마다 무언가 기록
    // chat.afterMessage(async (saved, { user }) => { await chat.pool.execute('...', [user.id]); });

    // 예) 모듈 전용 소켓 이벤트
    // chat.onConnection((socket, user) => {
    //   socket.on('template:ping', (payload, ack) => ack?.({ ok: true, pong: Date.now() }));
    // });
  },
};
