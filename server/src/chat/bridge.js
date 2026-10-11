// API 서버 ↔ 채팅 서버 내부 통로 — 채팅을 다른 포트(별도 프로세스)로 띄웠을 때만 씀
//   API 쪽에서 getChat() 이 돌려주는 '원격 채팅': roomsChanged() / sendSystem(roomId, text) / stats()
//   → 채팅 서버의 http://127.0.0.1:<채팅 포트>/internal/... 로 전달
// 서버 안(127.0.0.1)에서만, SESSION_SECRET 으로 만든 토큰이 맞을 때만 받음 (Nginx 로는 /internal 이 바깥에 열려 있지 않음)
const crypto = require('crypto');
const express = require('express');
const config = require('../config');

const TOKEN = crypto.createHmac('sha256', config.sessionSecret).update('projectq-chat-internal').digest('hex');
const HEADER = 'x-chat-internal';

// ---------- 채팅 서버 쪽: 받기 ----------
function internalRouter(getLocalChat) {
  const router = express.Router();
  router.use(express.json());
  router.use((req, res, next) => {
    const local = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress);
    const a = Buffer.from(String(req.get(HEADER) || ''));
    const b = Buffer.from(TOKEN);
    if (!local || a.length !== b.length || !crypto.timingSafeEqual(a, b)) return res.status(403).json({ message: 'forbidden' });
    next();
  });
  router.get('/health', (req, res) => res.json({ ok: true }));
  router.get('/stats', async (req, res) => res.json(await getLocalChat().stats()));
  router.post('/rooms-changed', (req, res) => { getLocalChat().roomsChanged(); res.json({ ok: true }); });
  router.post('/system', async (req, res, next) => {
    try {
      res.json({ message: await getLocalChat().sendSystem(Number(req.body?.roomId), String(req.body?.text ?? ''), req.body?.data ?? null) });
    } catch (err) {
      next(err);
    }
  });
  return router;
}

// ---------- API 쪽: 보내기 ----------
function remoteChat(port) {
  const call = async (method, path, body) => {
    const res = await fetch(`http://127.0.0.1:${port}/internal${path}`, {
      method,
      headers: { 'content-type': 'application/json', [HEADER]: TOKEN },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) throw new Error(`채팅 서버 응답 ${res.status}`);
    return res.json();
  };
  return {
    remote: true,
    // 방 목록이 바뀜 → 접속자 화면 새로고침 (채팅 서버가 꺼져 있어도 API 는 계속 동작)
    roomsChanged: () => call('POST', '/rooms-changed').catch((err) => console.error('[chat] 채팅 서버에 알리지 못함:', err.message)),
    sendSystem: async (roomId, text, data = null) => (await call('POST', '/system', { roomId, text, data })).message,
    stats: () => call('GET', '/stats').catch(() => ({ online: null, commands: [], offline: true })),
  };
}

module.exports = { internalRouter, remoteChat };
