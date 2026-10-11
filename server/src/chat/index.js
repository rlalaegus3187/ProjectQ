// 채팅 (Socket.IO) 코어 — 방 만들기·가입·나가기·삭제 · 입장 · 기록 · 메시지 · 접속자 · 입력 중 표시 + 모듈 붙이기
//
//   server/src/index.js:  const { setupChat } = require('./chat');  setupChat(httpServer, sessionMiddleware);
//   다른 서버 코드에서:     const { getChat } = require('./chat');  await getChat()?.sendSystem(roomId, '공지입니다');
//   (채팅을 다른 포트로 따로 띄웠으면 API 쪽 getChat() 은 내부 통로로 전달 — chat/bridge.js)
//
// 주소: Socket.IO path '/api/socket.io', 공간(roomspace)마다 네임스페이스 '/<공간>' — 목록은 chat/spaces.js (지금은 '/chat')
//   방 하나 = 소켓 room 'room:<방 번호>' (방 번호는 DB 가 자동으로 매김)
// 포트: API 와 같은 포트(같은 프로세스) 또는 따로 (src/chatServer.js) — server/.env 의 CHAT_PORT
//
// 로그인 세션(쿠키)을 그대로 씀 — 로그인한 회원만, CHAT_ROLES 권한만 (기본: 멤버·관리자)
// 채팅을 끄면(관리 → 채팅 관리) 관리자만, 사이트 비공개 모드면 관리자만
//
// 소켓 이벤트 (클라이언트 → 서버, 마지막 인자 ack 로 { ok, ... } 또는 { error } 응답)
//   rooms:list    { }                     → { rooms }      (이 공간의 방 + 가입 여부·인원·방장)
//   room:create   { name, description }   → { room }       (만든 사람이 방장, 자동 가입)
//   room:join     { roomId }              → { room }       (가입)
//   room:leave    { roomId }              → { destroyed }  (나가기 — 마지막 사람이 나가면 방 폭파)
//   room:delete   { roomId }              → { }            (방장·관리자, 상시 방은 관리자만)
//   room:enter    { roomId }              → { room, messages, hasMore, users, members, commands }   (가입한 방만, 최신 20개)
//   room:history  { roomId, beforeId }    → { messages, hasMore }   (위로 스크롤하면 이전 20개)
//   message:send  { roomId, text, faceId } → { }           ('/' 로 시작하면 명령어 — 모듈이 등록, faceId: 고른 표정(두상), 없으면 기본)
//   message:edit  { messageId, text, faceId } → { }        (내 일반 메시지 고치기 — 내용·표정)
//   message:delete { messageId }          → { }            (내 메시지 / 관리자는 모두)
//   본문은 마크다운(굵게·기울임·크게·작게 등) 그대로 저장 → 화면이 안전하게 바꿔서 보여줌 (client/src/markdown/render.js renderChat)
//   typing        { roomId }                                (입력 중 표시, 응답 없음)
// 서버 → 클라이언트
//   message:new { ...메시지 } · message:updated { ...메시지 } (고침) · message:deleted { id, roomId } · message:notice { text } (나에게만, 저장 안 됨)
//   room:users { roomId, users } · room:members { roomId, members } · typing { roomId, userId, name }
//   rooms:changed (방 목록이 바뀜 → 다시 불러오기) · room:closed { roomId, reason } (방이 사라졌거나 내가 나감 → 방에서 내보냄)
//
// 모듈: 공간의 modulesDir(기본 server/src/chat/modules/*.js)을 자동으로 불러옴 (이름이 _ 로 시작하면 건너뜀) — 쓰는 법은 chat/README.md
const fs = require('fs');
const path = require('path');
const { Server } = require('socket.io');
const pool = require('../db');
const { HttpError } = require('../errors');
const { isSiteClosed } = require('../settings');
const config = require('../config');
const store = require('./store');
const faces = require('../faces');
const { remoteChat } = require('./bridge');
const SPACES = require('./spaces');

const SOCKET_PATH = '/api/socket.io';
const CHAT_ROLES = ['admin', 'member'];   // 채팅을 쓸 수 있는 권한 (신청자도 쓰게 하려면 'applicant' 추가)
const RATE = { count: 5, perMs: 5000 };   // 5초에 5개까지
const roomKey = (roomId) => `room:${roomId}`;

const spaces = new Map();   // 공간 이름 → 모듈 API (setupChat 이후, getChat 으로 꺼냄)
const DEFAULT_SPACE = 'chat';

// 세션의 회원 → 채팅 사용자 { id, username, name(캐릭터 이름, 없으면 아이디), role, isAdmin }
async function loadUser(userId) {
  if (!userId) return null;
  const [rows] = await pool.execute(
    `SELECT u.id, u.username, u.role, c.name AS character_name
       FROM users u LEFT JOIN characters c ON c.user_id = u.id WHERE u.id = ?`,
    [userId],
  );
  const r = rows[0];
  return r ? { id: r.id, username: r.username, name: r.character_name || r.username, role: r.role, isAdmin: r.role === 'admin' } : null;
}

// 지금 채팅을 쓸 수 있는지 (매 메시지마다 다시 확인 — 권한 변경·탈퇴·채팅 끄기가 바로 반영)
async function assertCanChat(user) {
  if (!user) throw new HttpError(401, '로그인이 필요합니다.');
  if (!CHAT_ROLES.includes(user.role)) throw new HttpError(403, '멤버만 채팅을 이용할 수 있습니다.');
  if (user.isAdmin) return;
  if (await isSiteClosed()) throw new HttpError(403, '지금은 관리자만 이용할 수 있습니다.');
  if (!(await store.isChatEnabled())) throw new HttpError(403, '지금은 채팅을 이용할 수 없습니다.');
}

// 소켓 이벤트 처리 공통: 오류는 ack 로 { error } (예상하지 못한 오류는 로그에 남기고 일반 문구)
function handler(fn) {
  return async (payload, ack) => {
    const reply = typeof ack === 'function' ? ack : () => {};
    try {
      reply({ ok: true, ...((await fn(payload || {})) || {}) });
    } catch (err) {
      if (!err.expose) console.error(`[chat] ${new Date().toISOString()}`, err);
      reply({ error: err.expose ? err.message : '서버 오류가 발생했습니다.' });
    }
  };
}

function loadModules(api, dir) {
  if (!fs.existsSync(dir)) return [];
  const disabled = new Set(String(process.env.CHAT_MODULES_DISABLED || '').split(',').map((s) => s.trim()).filter(Boolean));
  const loaded = [];
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.js') && !f.startsWith('_')).sort()) {
    const mod = require(path.join(dir, file));
    const name = mod.name || path.basename(file, '.js');
    if (mod.enabled === false || disabled.has(name)) continue;
    mod.setup(api);
    loaded.push(name);
  }
  return loaded;
}

// 공간 하나 (네임스페이스 /<name>) — 모듈 API 를 돌려줌
function setupSpace(io, space) {
  const nsp = io.of(`/${space.name}`);

  // ---------- 모듈 API ----------
  const hooks = { before: [], after: [], join: [], leave: [], connection: [] };
  const commands = new Map();   // 이름 → { name, usage, description, handler }

  async function usersIn(roomId) {
    const sockets = await nsp.in(roomKey(roomId)).fetchSockets();
    const seen = new Map();
    for (const s of sockets) if (s.data.user) seen.set(s.data.user.id, { id: s.data.user.id, name: s.data.user.name, role: s.data.user.role });
    return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name, 'ko'));
  }
  async function broadcastUsers(roomId) {
    nsp.to(roomKey(roomId)).emit('room:users', { roomId, users: await usersIn(roomId) });
  }
  async function broadcastMembers(roomId) {
    nsp.to(roomKey(roomId)).emit('room:members', { roomId, members: await store.listMembers(roomId) });
  }
  // 방에서 소켓 내보내기 (userId 를 주면 그 사람만) — 화면에는 room:closed
  async function closeRoom(roomId, reason, userId = null) {
    const sockets = await nsp.in(roomKey(roomId)).fetchSockets();
    for (const s of sockets) {
      if (userId && s.data.user?.id !== userId) continue;
      s.emit('room:closed', { roomId, reason });
      s.leave(roomKey(roomId));
      if (s.data.roomId === roomId) s.data.roomId = null;
    }
    if (userId) await broadcastUsers(roomId);
  }
  // 저장 + 방에 보내기
  async function post(roomId, message) {
    const saved = await store.saveMessage({ roomId, ...message });
    nsp.to(roomKey(roomId)).emit('message:new', saved);
    return saved;
  }

  const api = {
    space: space.name, label: space.label,
    io, nsp, store, pool, HttpError,
    // 명령어 등록: chat.command('주사위', { aliases: ['dice'], usage: '/주사위 2d6', description }, async (ctx) => ...)
    //   ctx = { args, argText, user, room, socket, reply(text) }
    //   돌려준 { type, body, data } 는 그 사람이 보낸 메시지로 방에 올라감 / 안 돌려주면 아무것도 안 올라감
    command(name, options, fn) {
      const entry = { name, usage: options.usage || `/${name}`, description: options.description || '', handler: fn };
      for (const n of [name, ...(options.aliases || [])]) commands.set(n.toLowerCase(), entry);
    },
    beforeMessage(fn) { hooks.before.push(fn); },     // (msg, ctx) → msg(바꿔도 됨) | null(조용히 취소) — 막으려면 throw new HttpError(400, '이유')
    afterMessage(fn) { hooks.after.push(fn); },       // (savedMsg, ctx) — 저장·전송된 뒤
    onJoin(fn) { hooks.join.push(fn); },              // ({ user, room, socket }) — 방에 들어올 때(입장)
    onLeave(fn) { hooks.leave.push(fn); },            // ({ user, roomId, socket }) — 방에서 나갈 때(퇴장)
    onConnection(fn) { hooks.connection.push(fn); },  // (socket, user) — socket.on('내모듈:이벤트', ...) 추가할 때
    post,
    sendSystem: (roomId, text, data = null) => post(roomId, { type: 'system', body: text, data }),
    notice: (socket, text) => socket.emit('message:notice', { text }),   // 한 사람에게만, 저장 안 됨
    usersIn,
    roomsChanged: () => nsp.emit('rooms:changed'),
    // 방이 지워짐 (관리 화면 삭제 등) → 들어와 있던 사람 내보내고 목록 새로고침
    roomDeleted: async (roomId, reason = '방이 삭제되었습니다.') => { await closeRoom(Number(roomId), reason); nsp.emit('rooms:changed'); },
    stats: async () => ({ online: (await nsp.fetchSockets()).length, commands: api.commands() }),
    commands: () => [...new Set(commands.values())].map(({ name, usage, description }) => ({ name, usage, description })),
  };

  // 기본 명령어: /도움말
  api.command('도움말', { aliases: ['help'], usage: '/도움말', description: '쓸 수 있는 명령어 목록' }, ({ reply }) => {
    reply(api.commands().map((c) => `${c.usage} — ${c.description}`).join('\n'));
  });
  const modules = loadModules(api, space.modulesDir);
  console.log(`[chat] /${space.name} 모듈 ${modules.length ? modules.join(', ') : '없음'}`);

  // ---------- 접속 ----------
  nsp.use(async (socket, next) => {
    try {
      const user = await loadUser(socket.request.session?.userId);
      await assertCanChat(user);
      socket.data.user = user;
      next();
    } catch (err) {
      next(Object.assign(new Error(err.expose ? err.message : '접속할 수 없습니다.'), { data: { status: err.status || 500 } }));
    }
  });

  nsp.on('connection', (socket) => {
    const sent = [];   // 보낸 시각 (도배 방지)

    async function leaveCurrent() {
      const roomId = socket.data.roomId;
      if (!roomId) return;
      socket.leave(roomKey(roomId));
      socket.data.roomId = null;
      await broadcastUsers(roomId);
      for (const fn of hooks.leave) await fn({ user: socket.data.user, roomId, socket });
    }

    // 매번 최신 회원 정보로 (권한 변경·탈퇴·채팅 끄기 반영)
    async function freshUser() {
      const user = await loadUser(socket.data.user.id);
      await assertCanChat(user);
      socket.data.user = user;
      return user;
    }
    const roomFor = (user, roomId) => store.getRoomFor(space.name, user, roomId);
    async function memberRoom(user, roomId) {
      const room = await roomFor(user, roomId);
      if (!room.joined) throw new HttpError(403, '가입한 방에서만 대화할 수 있습니다. 먼저 [가입]해주세요.');
      return room;
    }

    socket.on('rooms:list', handler(async () => ({ rooms: await store.listRooms(space.name, { user: await freshUser() }) })));

    socket.on('room:create', handler(async (body) => {
      const user = await freshUser();
      const id = await store.createRoom(space.name, user, body);
      api.roomsChanged();
      return { room: await roomFor(user, id) };
    }));

    socket.on('room:join', handler(async ({ roomId }) => {
      const user = await freshUser();
      const room = await roomFor(user, roomId);
      if (await store.joinRoom(room, user)) {
        await broadcastMembers(room.id);
        api.roomsChanged();
      }
      return { room: { ...room, joined: true } };
    }));

    socket.on('room:leave', handler(async ({ roomId }) => {
      const user = await freshUser();
      const room = await roomFor(user, roomId);
      const { destroyed } = await store.leaveRoom(room, user);
      if (destroyed) {
        await closeRoom(room.id, `'${room.name}' 방은 모두 나가서 사라졌습니다.`);
      } else {
        await closeRoom(room.id, `'${room.name}' 방에서 나왔습니다.`, user.id);   // 내 다른 창도
        await broadcastMembers(room.id);
      }
      api.roomsChanged();
      return { destroyed };
    }));

    socket.on('room:delete', handler(async ({ roomId }) => {
      const user = await freshUser();
      const room = await roomFor(user, roomId);
      await store.deleteRoom(room, user);
      await api.roomDeleted(room.id, `'${room.name}' 방이 삭제되었습니다.`);
    }));

    socket.on('room:enter', handler(async ({ roomId }) => {
      const user = await freshUser();
      const room = await memberRoom(user, roomId);
      if (socket.data.roomId !== room.id) {
        await leaveCurrent();
        socket.join(roomKey(room.id));
        socket.data.roomId = room.id;
        await broadcastUsers(room.id);
        for (const fn of hooks.join) await fn({ user, room, socket });
      }
      const { messages, hasMore } = await store.getHistory(room.id);
      return { room, messages, hasMore, users: await usersIn(room.id), members: await store.listMembers(room.id), commands: api.commands() };
    }));

    socket.on('room:history', handler(async ({ roomId, beforeId }) => {
      const room = await memberRoom(await freshUser(), roomId);
      return store.getHistory(room.id, { beforeId: Number(beforeId) || null });
    }));

    const parseBody = (text) => {
      const body = String(text ?? '').trim();
      if (!body) throw new HttpError(400, '내용을 입력해주세요.');
      if (body.length > store.MAX_BODY) throw new HttpError(400, `메시지는 ${store.MAX_BODY}자 이내로 보내주세요.`);
      return body;
    };

    socket.on('message:send', handler(async ({ roomId, text, faceId }) => {
      const now = Date.now();
      while (sent.length && now - sent[0] > RATE.perMs) sent.shift();
      if (sent.length >= RATE.count) throw new HttpError(429, '메시지를 너무 빨리 보내고 있습니다. 잠시 후 다시 보내주세요.');
      sent.push(now);

      const user = await freshUser();
      const room = await memberRoom(user, roomId);
      if (socket.data.roomId !== room.id) throw new HttpError(400, '먼저 채팅방에 들어가주세요.');
      const body = parseBody(text);
      const face = await faces.ownFaceId(user.id, faceId);
      const ctx = { user, room, socket, faceId: face, reply: (t) => api.notice(socket, t) };

      // 명령어
      let msg = { type: 'text', body, data: null };
      if (body.startsWith('/')) {
        const [name, ...args] = body.slice(1).split(/\s+/);
        const cmd = commands.get(name.toLowerCase());
        if (!cmd) throw new HttpError(400, `없는 명령어입니다: /${name} (/도움말 로 목록 보기)`);
        const result = await cmd.handler({ ...ctx, args, argText: body.slice(name.length + 1).trim() });
        if (!result) return {};
        msg = { type: 'text', data: null, ...result };
      }
      // 모듈: 보내기 전 (바꾸거나 취소)
      for (const fn of hooks.before) {
        msg = await fn(msg, ctx);
        if (!msg) return {};
      }
      const saved = await post(room.id, { faceId: face, ...msg, user });
      for (const fn of hooks.after) {
        try { await fn(saved, ctx); } catch (err) { console.error('[chat] afterMessage 오류', err); }
      }
      return {};
    }));

    socket.on('message:edit', handler(async ({ messageId, text, faceId }) => {
      const user = await freshUser();
      const roomId = await store.messageRoomId(messageId);
      if (!roomId) throw new HttpError(404, '없는 메시지입니다.');
      await memberRoom(user, roomId);
      const updated = await store.editMessage(user, messageId, { body: parseBody(text), faceId: await faces.ownFaceId(user.id, faceId) });
      nsp.to(roomKey(roomId)).emit('message:updated', updated);
    }));

    socket.on('message:delete', handler(async ({ messageId }) => {
      const removed = await store.deleteMessage(await freshUser(), messageId);
      nsp.to(roomKey(removed.roomId)).emit('message:deleted', removed);
    }));

    socket.on('typing', ({ roomId } = {}) => {
      if (socket.data.roomId && socket.data.roomId === Number(roomId)) {
        socket.to(roomKey(roomId)).emit('typing', { roomId: Number(roomId), userId: socket.data.user.id, name: socket.data.user.name });
      }
    });

    socket.on('disconnect', () => { leaveCurrent().catch((err) => console.error('[chat] disconnect', err)); });

    for (const fn of hooks.connection) fn(socket, socket.data.user);
  });

  return api;
}

function setupChat(httpServer, sessionMiddleware) {
  const io = new Server(httpServer, { path: SOCKET_PATH, serveClient: false });
  io.engine.use(sessionMiddleware);   // express-session 쿠키 → socket.request.session
  for (const space of SPACES) spaces.set(space.name, setupSpace(io, space));
  return spaces.get(DEFAULT_SPACE);
}

// 이 프로세스의 채팅 — 없고(API 서버) 채팅을 따로 띄웠으면 내부 통로로 전달하는 원격 채팅
//   getChat()          기본 공간('chat') · getChat('investigation') 다른 공간
const remotes = new Map();
function getChat(space = DEFAULT_SPACE) {
  if (spaces.size) return spaces.get(space) || null;
  if (!config.chatSeparate || !SPACES.some((s) => s.name === space)) return null;
  if (!remotes.has(space)) remotes.set(space, remoteChat(config.chatPort, space));
  return remotes.get(space);
}

module.exports = { setupChat, getChat, SOCKET_PATH, CHAT_ROLES, SPACES, DEFAULT_SPACE };
