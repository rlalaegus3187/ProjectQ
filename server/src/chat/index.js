// 채팅 (Socket.IO) 코어 — 방 입장 · 기록 · 메시지 · 삭제 · 접속자 · 입력 중 표시 + 모듈 붙이기
//
//   server/src/index.js:  const { setupChat } = require('./chat');  setupChat(httpServer, sessionMiddleware);
//   다른 서버 코드에서:     const { getChat } = require('./chat');  await getChat()?.sendSystem(roomId, '공지입니다');
//   (채팅을 다른 포트로 따로 띄웠으면 API 쪽 getChat() 은 내부 통로로 전달 — chat/bridge.js)
//
// 주소: Socket.IO path '/api/socket.io', 네임스페이스 '/chat'
// 포트: API 와 같은 포트(같은 프로세스) 또는 따로 (src/chatServer.js) — server/.env 의 CHAT_PORT
//
// 로그인 세션(쿠키)을 그대로 씀 — 로그인한 회원만, CHAT_ROLES 권한만 (기본: 멤버·관리자)
// 채팅을 끄면(관리 → 채팅 관리) 관리자만, 사이트 비공개 모드면 관리자만
//
// 소켓 이벤트 (클라이언트 → 서버, 마지막 인자 ack 로 { ok, ... } 또는 { error } 응답)
//   room:join     { roomId }              → { room, messages, users, commands }   (다른 방에 있었으면 나옴)
//   room:history  { roomId, beforeId }    → { messages }   (이전 기록 더 보기)
//   message:send  { roomId, text }        → { }            ('/' 로 시작하면 명령어 — 모듈이 등록)
//   message:delete { messageId }          → { }            (내 메시지 / 관리자는 모두)
//   typing        { roomId }                                (입력 중 표시, 응답 없음)
// 서버 → 클라이언트
//   message:new { ...메시지 } · message:deleted { id, roomId } · message:notice { text } (나에게만, 저장 안 됨)
//   room:users { roomId, users } · typing { roomId, userId, name } · rooms:changed (방 목록이 바뀜)
//
// 모듈: server/src/chat/modules/*.js 를 자동으로 불러옴 (이름이 _ 로 시작하면 건너뜀) — 쓰는 법은 chat/README.md
const fs = require('fs');
const path = require('path');
const { Server } = require('socket.io');
const pool = require('../db');
const { HttpError } = require('../errors');
const { isSiteClosed } = require('../settings');
const config = require('../config');
const store = require('./store');
const { remoteChat } = require('./bridge');

const SOCKET_PATH = '/api/socket.io';
const CHAT_ROLES = ['admin', 'member'];   // 채팅을 쓸 수 있는 권한 (신청자도 쓰게 하려면 'applicant' 추가)
const RATE = { count: 5, perMs: 5000 };   // 5초에 5개까지
const roomKey = (roomId) => `room:${roomId}`;

let chat = null;   // setupChat 이후의 모듈 API (getChat 으로 꺼냄)

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

function loadModules(api) {
  const dir = path.join(__dirname, 'modules');
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

function setupChat(httpServer, sessionMiddleware) {
  const io = new Server(httpServer, { path: SOCKET_PATH, serveClient: false });
  io.engine.use(sessionMiddleware);   // express-session 쿠키 → socket.request.session
  const nsp = io.of('/chat');

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
  // 저장 + 방에 보내기
  async function post(roomId, message) {
    const saved = await store.saveMessage({ roomId, ...message });
    nsp.to(roomKey(roomId)).emit('message:new', saved);
    return saved;
  }

  chat = {
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
    onJoin(fn) { hooks.join.push(fn); },              // ({ user, room, socket })
    onLeave(fn) { hooks.leave.push(fn); },            // ({ user, roomId, socket })
    onConnection(fn) { hooks.connection.push(fn); },  // (socket, user) — socket.on('내모듈:이벤트', ...) 추가할 때
    post,
    sendSystem: (roomId, text, data = null) => post(roomId, { type: 'system', body: text, data }),
    notice: (socket, text) => socket.emit('message:notice', { text }),   // 한 사람에게만, 저장 안 됨
    usersIn,
    roomsChanged: () => nsp.emit('rooms:changed'),
  stats: async () => ({ online: (await nsp.fetchSockets()).length, commands: chat.commands() }),
    commands: () => [...new Set(commands.values())].map(({ name, usage, description }) => ({ name, usage, description })),
  };

  // 기본 명령어: /도움말
  chat.command('도움말', { aliases: ['help'], usage: '/도움말', description: '쓸 수 있는 명령어 목록' }, ({ reply }) => {
    reply(chat.commands().map((c) => `${c.usage} — ${c.description}`).join('\n'));
  });
  const modules = loadModules(chat);
  console.log(`[chat] 모듈 ${modules.length ? modules.join(', ') : '없음'}`);

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

    socket.on('room:join', handler(async ({ roomId }) => {
      const user = await freshUser();
      const room = await store.getRoomFor(user, roomId);
      if (socket.data.roomId !== room.id) {
        await leaveCurrent();
        socket.join(roomKey(room.id));
        socket.data.roomId = room.id;
        await broadcastUsers(room.id);
        for (const fn of hooks.join) await fn({ user, room, socket });
      }
      return { room, messages: await store.getHistory(room.id), users: await usersIn(room.id), commands: chat.commands() };
    }));

    socket.on('room:history', handler(async ({ roomId, beforeId }) => {
      const room = await store.getRoomFor(await freshUser(), roomId);
      return { messages: await store.getHistory(room.id, { beforeId: Number(beforeId) || null }) };
    }));

    socket.on('message:send', handler(async ({ roomId, text }) => {
      const now = Date.now();
      while (sent.length && now - sent[0] > RATE.perMs) sent.shift();
      if (sent.length >= RATE.count) throw new HttpError(429, '메시지를 너무 빨리 보내고 있습니다. 잠시 후 다시 보내주세요.');
      sent.push(now);

      const user = await freshUser();
      const room = await store.getRoomFor(user, roomId);
      if (socket.data.roomId !== room.id) throw new HttpError(400, '먼저 채팅방에 들어가주세요.');
      const body = String(text ?? '').trim();
      if (!body) throw new HttpError(400, '내용을 입력해주세요.');
      if (body.length > store.MAX_BODY) throw new HttpError(400, `메시지는 ${store.MAX_BODY}자 이내로 보내주세요.`);
      const ctx = { user, room, socket, reply: (t) => chat.notice(socket, t) };

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
      const saved = await post(room.id, { ...msg, user });
      for (const fn of hooks.after) {
        try { await fn(saved, ctx); } catch (err) { console.error('[chat] afterMessage 오류', err); }
      }
      return {};
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

  return chat;
}

// 이 프로세스의 채팅 — 없고(API 서버) 채팅을 따로 띄웠으면 내부 통로로 전달하는 원격 채팅
let remote = null;
const getChat = () => chat || (config.chatSeparate ? (remote ||= remoteChat(config.chatPort)) : null);

module.exports = { setupChat, getChat, SOCKET_PATH, CHAT_ROLES };
