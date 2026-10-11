// 채팅 DB 처리 (chat_rooms / chat_room_members / chat_messages) — 코어(space.js)와 모듈, REST(routes/chat.js)가 같이 씀
//
// 방은 공간(space = Socket.IO 네임스페이스 이름, 예: 'chat')에 속함
//   회원 방: 회원이 만들고 가입/나가기, 마지막 사람이 나가면 폭파(삭제)
//   상시 방(is_permanent): 관리 → 채팅 관리에서 만든 방, 비어도 남음
const pool = require('../db');
const { HttpError } = require('../errors');
const { getSetting } = require('../settings');
const { withTransaction } = require('../characters');

const MAX_BODY = 1000;          // 메시지 최대 글자 수
const HISTORY_LIMIT = 20;       // 한 번에 불러오는 기록 수 (처음 최신 20개, 위로 스크롤하면 20개씩 더)
const MAX_OWNED_ROOMS = 5;      // 회원 한 명이 방장으로 가질 수 있는 회원 방 수 (관리자는 제한 없음)

// 채팅 사용 여부 (관리 → 채팅 관리, settings.chat_enabled = '0' 이면 끔 — 관리자는 꺼져 있어도 들어갈 수 있음)
async function isChatEnabled(conn = pool) {
  return (await getSetting('chat_enabled', conn)) !== '0';
}

const ROOM_COLUMNS = `r.id, r.space, r.name, r.description, r.owner_id, r.is_permanent, r.is_active, r.admin_only, r.sort_order, r.created_at,
  COALESCE(oc.name, ou.username) AS owner_name,
  (SELECT COUNT(*) FROM chat_room_members m WHERE m.room_id = r.id) AS member_count`;
const ROOM_FROM = `chat_rooms r
  LEFT JOIN users ou ON ou.id = r.owner_id
  LEFT JOIN characters oc ON oc.user_id = r.owner_id`;

const toRoom = (r) => ({
  id: r.id,
  space: r.space,
  name: r.name,
  description: r.description || '',
  ownerId: r.owner_id,
  ownerName: r.owner_name || null,
  isPermanent: !!r.is_permanent,
  isActive: !!r.is_active,
  adminOnly: !!r.admin_only,
  sortOrder: r.sort_order,
  memberCount: Number(r.member_count ?? 0),
  createdAt: r.created_at,
  ...(r.joined !== undefined ? { joined: !!r.joined } : {}),
  ...(r.message_count !== undefined ? { messageCount: Number(r.message_count) } : {}),
});

// 방 목록 — user 가 있으면 그 사람이 볼 수 있는 방 + 가입 여부 / all: 관리 화면용 (닫힌 방 포함, 메시지 수)
// 순서: 상시 방(정한 순서) → 회원 방(최근에 만든 순)
async function listRooms(space, { user = null, all = false } = {}, conn = pool) {
  const where = ['r.space = ?'];
  if (!all) {
    where.push('r.is_active = 1');
    if (!user?.isAdmin) where.push('r.admin_only = 0');
  }
  const [rows] = await conn.query(
    `SELECT ${ROOM_COLUMNS}
            ${user ? ', EXISTS (SELECT 1 FROM chat_room_members m WHERE m.room_id = r.id AND m.user_id = ?) AS joined' : ''}
            ${all ? ', (SELECT COUNT(*) FROM chat_messages cm WHERE cm.room_id = r.id AND cm.is_deleted = 0) AS message_count' : ''}
       FROM ${ROOM_FROM}
      WHERE ${where.join(' AND ')}
      ORDER BY r.is_permanent DESC, (CASE WHEN r.is_permanent = 1 THEN r.sort_order ELSE 0 END), r.id DESC`,
    user ? [user.id, space] : [space],
  );
  return rows.map(toRoom);
}

// 방 하나 (볼 수 있는지 확인) — 없거나 닫혔거나 관리자 전용이면 오류
async function getRoomFor(space, user, roomId, conn = pool) {
  const [rows] = await conn.query(
    `SELECT ${ROOM_COLUMNS}, EXISTS (SELECT 1 FROM chat_room_members m WHERE m.room_id = r.id AND m.user_id = ?) AS joined
       FROM ${ROOM_FROM} WHERE r.id = ? AND r.space = ?`,
    [user.id, Number(roomId) || 0, space],
  );
  const room = rows[0] && toRoom(rows[0]);
  if (!room || !room.isActive) throw new HttpError(404, '없는 채팅방입니다. (폭파됐거나 닫혔을 수 있음)');
  if (room.adminOnly && !user.isAdmin) throw new HttpError(403, '관리자만 들어갈 수 있는 방입니다.');
  return room;
}

// 가입자 [{ id, name, role, joinedAt }] (먼저 들어온 순)
async function listMembers(roomId, conn = pool) {
  const [rows] = await conn.query(
    `SELECT u.id, u.role, COALESCE(c.name, u.username) AS name, m.joined_at
       FROM chat_room_members m JOIN users u ON u.id = m.user_id LEFT JOIN characters c ON c.user_id = u.id
      WHERE m.room_id = ? ORDER BY m.joined_at, u.id`,
    [roomId],
  );
  return rows.map((r) => ({ id: r.id, name: r.name, role: r.role, joinedAt: r.joined_at }));
}

function parseRoomInput(body) {
  const name = String(body?.name ?? '').trim();
  if (!name || name.length > 50) throw new HttpError(400, '방 이름은 1~50자로 입력해주세요.');
  const description = String(body?.description ?? '').trim();
  if (description.length > 255) throw new HttpError(400, '설명은 255자 이내로 입력해주세요.');
  return { name, description: description || null };
}

// 회원이 방 만들기 → 방 번호 (만든 사람이 방장, 자동 가입)
async function createRoom(space, user, body) {
  const d = parseRoomInput(body);
  return withTransaction(async (conn) => {
    if (!user.isAdmin) {
      const [[{ owned }]] = await conn.query(
        'SELECT COUNT(*) AS owned FROM chat_rooms WHERE space = ? AND owner_id = ? AND is_permanent = 0', [space, user.id],
      );
      if (Number(owned) >= MAX_OWNED_ROOMS) throw new HttpError(400, `방장인 방은 ${MAX_OWNED_ROOMS}개까지 만들 수 있습니다. 쓰지 않는 방을 지운 뒤 만들어주세요.`);
    }
    const [r] = await conn.execute(
      'INSERT INTO chat_rooms (space, name, description, owner_id, is_permanent, sort_order) VALUES (?, ?, ?, ?, 0, 0)',
      [space, d.name, d.description, user.id],
    );
    await conn.execute('INSERT INTO chat_room_members (room_id, user_id) VALUES (?, ?)', [r.insertId, user.id]);
    return r.insertId;
  });
}

// 가입 (이미 가입했으면 그대로) → 새로 가입했으면 true
async function joinRoom(room, user, conn = pool) {
  const [r] = await conn.execute('INSERT IGNORE INTO chat_room_members (room_id, user_id) VALUES (?, ?)', [room.id, user.id]);
  return r.affectedRows > 0;
}

const isMember = async (roomId, userId, conn = pool) => {
  const [rows] = await conn.execute('SELECT 1 FROM chat_room_members WHERE room_id = ? AND user_id = ?', [roomId, userId]);
  return !!rows[0];
};

// 나가기 → { destroyed } — 회원 방에서 마지막 사람이 나가면 방 폭파(메시지·가입 함께 삭제), 방장이 나가면 가장 먼저 들어온 사람에게
async function leaveRoom(room, user) {
  return withTransaction(async (conn) => {
    const [lock] = await conn.execute('SELECT id, owner_id, is_permanent FROM chat_rooms WHERE id = ? FOR UPDATE', [room.id]);
    if (!lock[0]) return { destroyed: true };
    const [r] = await conn.execute('DELETE FROM chat_room_members WHERE room_id = ? AND user_id = ?', [room.id, user.id]);
    if (!r.affectedRows) throw new HttpError(400, '가입한 방이 아닙니다.');
    const [rest] = await conn.execute('SELECT user_id FROM chat_room_members WHERE room_id = ? ORDER BY joined_at, user_id LIMIT 1', [room.id]);
    if (!rest[0] && !lock[0].is_permanent) {
      await conn.execute('DELETE FROM chat_rooms WHERE id = ?', [room.id]);   // 폭파
      return { destroyed: true };
    }
    if (lock[0].owner_id === user.id) {
      await conn.execute('UPDATE chat_rooms SET owner_id = ? WHERE id = ?', [rest[0]?.user_id ?? null, room.id]);
    }
    return { destroyed: false };
  });
}

// 방 삭제 — 회원 방은 방장·관리자, 상시 방은 관리자만
async function deleteRoom(room, user, conn = pool) {
  if (!user.isAdmin && (room.isPermanent || room.ownerId !== user.id)) {
    throw new HttpError(403, room.isPermanent ? '상시 방은 관리자만 지울 수 있습니다.' : '방장만 방을 지울 수 있습니다.');
  }
  await conn.execute('DELETE FROM chat_rooms WHERE id = ?', [room.id]);
}

// 아무도 없는 회원 방 정리 (계정 삭제로 마지막 가입자가 사라진 경우 등) → 지운 방 수
async function deleteEmptyRooms(conn = pool) {
  const [r] = await conn.query(
    `DELETE FROM chat_rooms WHERE is_permanent = 0
       AND NOT EXISTS (SELECT 1 FROM chat_room_members m WHERE m.room_id = chat_rooms.id)`,
  );
  return r.affectedRows;
}

// 계정 삭제 뒤 정리 — 빈 회원 방 폭파 + 방장이 사라진 방은 가장 먼저 들어온 사람에게 → 지운 방 수
async function cleanupAfterUserDelete(conn = pool) {
  const removed = await deleteEmptyRooms(conn);
  await conn.query(
    `UPDATE chat_rooms r SET r.owner_id = (SELECT m.user_id FROM chat_room_members m WHERE m.room_id = r.id ORDER BY m.joined_at, m.user_id LIMIT 1)
      WHERE r.owner_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM users u WHERE u.id = r.owner_id)`,
  );
  return removed;
}

function parseJson(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === 'object') return v;
  try { return JSON.parse(v); } catch { return null; }
}

// 화면에 보낼 메시지 모양
const toMessage = (r) => ({
  id: Number(r.id),
  roomId: r.room_id,
  userId: r.user_id,
  author: r.author_name,
  authorRole: r.author_role,
  type: r.type,
  body: r.is_deleted ? null : r.body,
  data: r.is_deleted ? null : parseJson(r.data),
  // 말할 때 고른 표정(두상) — character_faces 에서 찾아 붙임 (표정을 지웠으면 null)
  face: r.face_id && r.face_image ? { id: r.face_id, code: r.face_code, name: r.face_name, image: r.face_image } : null,
  deleted: !!r.is_deleted,
  editedAt: r.edited_at || null,
  createdAt: r.created_at,
});

const MESSAGE_SELECT = `SELECT m.id, m.room_id, m.user_id, m.author_name, m.author_role, m.type, m.body, m.data, m.is_deleted, m.edited_at, m.created_at,
         m.face_id, f.code AS face_code, f.name AS face_name, f.image AS face_image
    FROM chat_messages m LEFT JOIN character_faces f ON f.id = m.face_id`;
const getMessage = async (id, conn = pool) => {
  const [rows] = await conn.execute(`${MESSAGE_SELECT} WHERE m.id = ?`, [id]);
  return rows[0] ? toMessage(rows[0]) : null;
};

// 기록 (beforeId 보다 이전 것, 최신부터 limit 개) — 오래된 것이 앞. hasMore: 더 이전 기록이 있는지
async function getHistory(roomId, { beforeId = null, limit = HISTORY_LIMIT } = {}, conn = pool) {
  const [rows] = await conn.query(
    `${MESSAGE_SELECT}
      WHERE m.room_id = ?${beforeId ? ' AND m.id < ?' : ''} ORDER BY m.id DESC LIMIT ?`,
    beforeId ? [roomId, beforeId, limit + 1] : [roomId, limit + 1],
  );
  const hasMore = rows.length > limit;
  return { messages: rows.slice(0, limit).reverse().map(toMessage), hasMore };
}

// 저장 → 저장된 메시지. user 가 없으면 시스템 메시지. faceId: 고른 표정 (확인은 부르는 쪽 — faces.ownFaceId)
async function saveMessage({ roomId, user = null, type = 'text', body = null, data = null, faceId = null }, conn = pool) {
  if (!/^[a-z][a-z0-9_]{0,29}$/.test(type)) throw new Error(`chat: 잘못된 메시지 type (${type})`);
  const text = body === null ? null : String(body).slice(0, MAX_BODY * 2);
  const [result] = await conn.execute(
    'INSERT INTO chat_messages (room_id, user_id, author_name, author_role, face_id, type, body, data) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [roomId, user?.id ?? null, user?.name ?? null, user?.role ?? null, user ? faceId : null, type, text, data === null ? null : JSON.stringify(data)],
  );
  return getMessage(result.insertId, conn);
}

// 고치기 (내 일반 메시지만) — { body, faceId } → 고친 메시지. 가입한 방인지는 부르는 쪽에서 확인
async function editMessage(user, messageId, { body, faceId }, conn = pool) {
  const [rows] = await conn.execute('SELECT id, room_id, user_id, type, is_deleted FROM chat_messages WHERE id = ?', [Number(messageId) || 0]);
  const m = rows[0];
  if (!m || m.is_deleted) throw new HttpError(404, '없는 메시지입니다.');
  if (m.user_id !== user.id) throw new HttpError(403, '내 메시지만 고칠 수 있습니다.');
  if (m.type !== 'text') throw new HttpError(400, '일반 메시지만 고칠 수 있습니다. (명령어 결과 등은 불가)');
  await conn.execute('UPDATE chat_messages SET body = ?, face_id = ?, edited_at = NOW() WHERE id = ?', [body, faceId, m.id]);
  return getMessage(m.id, conn);
}

const messageRoomId = async (messageId, conn = pool) => {
  const [[row]] = await conn.execute('SELECT room_id FROM chat_messages WHERE id = ?', [Number(messageId) || 0]);
  return row?.room_id ?? null;
};

// 삭제 (본인 메시지 또는 관리자) → 삭제된 메시지 { id, roomId }
async function deleteMessage(user, messageId, conn = pool) {
  const [rows] = await conn.execute('SELECT id, room_id, user_id, is_deleted FROM chat_messages WHERE id = ?', [Number(messageId) || 0]);
  const m = rows[0];
  if (!m || m.is_deleted) throw new HttpError(404, '없는 메시지입니다.');
  if (!user.isAdmin && m.user_id !== user.id) throw new HttpError(403, '내 메시지만 지울 수 있습니다.');
  await conn.execute('UPDATE chat_messages SET is_deleted = 1 WHERE id = ?', [m.id]);
  return { id: Number(m.id), roomId: m.room_id };
}

module.exports = {
  MAX_BODY, HISTORY_LIMIT, MAX_OWNED_ROOMS, isChatEnabled,
  listRooms, getRoomFor, listMembers, parseRoomInput, createRoom, joinRoom, isMember, leaveRoom, deleteRoom, deleteEmptyRooms, cleanupAfterUserDelete,
  getHistory, getMessage, saveMessage, editMessage, messageRoomId, deleteMessage, toRoom,
};
