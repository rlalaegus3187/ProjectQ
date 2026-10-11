// 채팅방 REST (메시지 주고받기는 Socket.IO — server/src/chat/)
// 회원이 방 만들기·가입·나가기·삭제는 소켓 이벤트 (room:create / room:join / room:leave / room:delete)
//   회원:   GET /api/chat/rooms                    채팅 공간의 방(가입 여부·인원·방장) + 지금 가입한 방(currentRoomId) + 채팅 사용 여부
//   관리자: GET    /api/admin/chat                  방 전체(닫힌 방·회원 방 포함, 메시지 수) + 채팅 정보(포트·주소·모듈)
//           POST   /api/admin/chat/rooms            방 추가 { name, description, isActive, adminOnly, isPermanent, sortOrder } (기본 상시 방)
//           PUT    /api/admin/chat/rooms/:id        수정 (상시 방을 끄면 회원 방 — 아무도 없으면 바로 폭파)
//           DELETE /api/admin/chat/rooms/:id        삭제 (메시지·가입도 함께, 들어와 있던 사람은 내보냄)
//           DELETE /api/admin/chat/rooms/:id/messages  대화 기록 비우기
// 채팅 켜기/끄기는 PUT /api/admin/settings { chatEnabled }
const express = require('express');
const pool = require('../db');
const config = require('../config');
const requireAuth = require('../middleware/requireAuth');
const requireAdmin = require('../middleware/requireAdmin');
const { HttpError } = require('../errors');
const store = require('../chat/store');
const { getChat, SOCKET_PATH, CHAT_ROLES, DEFAULT_SPACE } = require('../chat');

const memberRouter = express.Router();
memberRouter.get('/chat/rooms', requireAuth, async (req, res) => {
  const [[user]] = await pool.execute('SELECT id, role FROM users WHERE id = ?', [req.session.userId]);
  const canChat = CHAT_ROLES.includes(user?.role);
  res.json({
    enabled: await store.isChatEnabled(),
    canChat,
    rooms: canChat ? await store.listRooms(DEFAULT_SPACE, { user: { id: user.id, isAdmin: user.role === 'admin' } }) : [],
    currentRoomId: canChat ? await store.currentRoomId(user.id) : null,   // 지금 가입한 방 (한 번에 한 방, 없으면 null)
  });
});

const adminRouter = express.Router();
adminRouter.use('/chat', requireAdmin);

function parseRoom(body) {
  const name = String(body?.name ?? '').trim();
  if (!name || name.length > 50) throw new HttpError(400, '방 이름은 1~50자로 입력해주세요.');
  const description = String(body?.description ?? '').trim();
  if (description.length > 255) throw new HttpError(400, '설명은 255자 이내로 입력해주세요.');
  const sortOrder = Number(body?.sortOrder ?? 0);
  if (!Number.isInteger(sortOrder) || Math.abs(sortOrder) > 100000) throw new HttpError(400, '순서는 정수로 입력해주세요.');
  return {
    name, description: description || null, sortOrder,
    isActive: body?.isActive !== false ? 1 : 0, adminOnly: body?.adminOnly ? 1 : 0, isPermanent: body?.isPermanent !== false ? 1 : 0,
  };
}

async function sendAdmin(res, status = 200) {
  const stats = (await getChat()?.stats()) || { online: null, commands: [] };
  res.status(status).json({
    rooms: await store.listRooms(DEFAULT_SPACE, { all: true }),
    enabled: await store.isChatEnabled(),
    // 화면에 보여주는 정보 (바꾸는 곳은 server/.env 와 Nginx — 채팅은 API 와 같은 포트를 같이 씀)
    info: {
      port: config.port,
      socketPath: SOCKET_PATH,
      roles: CHAT_ROLES,
      chatPort: config.chatPort,
      separate: config.chatSeparate,   // 채팅을 따로 띄웠는지 (포트가 다름)
      modules: stats.commands,
      online: stats.online,            // null 이면 채팅 서버에 연결 못 함
      chatOffline: !!stats.offline,
    },
  });
}
const changed = () => getChat()?.roomsChanged();

adminRouter.get('/chat', (req, res) => sendAdmin(res));

adminRouter.post('/chat/rooms', async (req, res) => {
  const d = parseRoom(req.body);
  await pool.execute(
    'INSERT INTO chat_rooms (space, name, description, is_active, admin_only, is_permanent, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [DEFAULT_SPACE, d.name, d.description, d.isActive, d.adminOnly, d.isPermanent, d.sortOrder],
  );
  changed();
  await sendAdmin(res, 201);
});

adminRouter.put('/chat/rooms/:id', async (req, res) => {
  const d = parseRoom(req.body);
  const [result] = await pool.execute(
    'UPDATE chat_rooms SET name = ?, description = ?, is_active = ?, admin_only = ?, is_permanent = ?, sort_order = ? WHERE id = ?',
    [d.name, d.description, d.isActive, d.adminOnly, d.isPermanent, d.sortOrder, Number(req.params.id) || 0],
  );
  if (!result.affectedRows) throw new HttpError(404, '채팅방을 찾을 수 없습니다.');
  const id = Number(req.params.id);
  const [[still]] = await pool.execute('SELECT COUNT(*) AS n FROM chat_rooms WHERE id = ?', [id]);
  if (!d.isPermanent) await store.deleteEmptyRooms();
  const [[after]] = await pool.execute('SELECT COUNT(*) AS n FROM chat_rooms WHERE id = ?', [id]);
  if (still.n && !after.n) await getChat()?.roomDeleted(id, `'${d.name}' 방은 아무도 없어 사라졌습니다.`);
  else if (!d.isActive || d.adminOnly) await getChat()?.roomDeleted(id, `'${d.name}' 방이 닫혔습니다.`);
  else changed();
  await sendAdmin(res);
});

adminRouter.delete('/chat/rooms/:id', async (req, res) => {
  const id = Number(req.params.id) || 0;
  const [result] = await pool.execute('DELETE FROM chat_rooms WHERE id = ?', [id]);
  if (!result.affectedRows) throw new HttpError(404, '채팅방을 찾을 수 없습니다.');
  await getChat()?.roomDeleted(id, '관리자가 방을 삭제했습니다.');
  await sendAdmin(res);
});

adminRouter.delete('/chat/rooms/:id/messages', async (req, res) => {
  const [result] = await pool.execute('DELETE FROM chat_messages WHERE room_id = ?', [Number(req.params.id) || 0]);
  changed();
  res.json({ deleted: result.affectedRows });
});

module.exports = { memberRouter, adminRouter };
