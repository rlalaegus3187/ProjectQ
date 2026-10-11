// 채팅 DB 처리 (chat_rooms / chat_messages) — 코어(index.js)와 모듈이 같이 씀
const pool = require('../db');
const { HttpError } = require('../errors');
const { getSetting } = require('../settings');

const MAX_BODY = 1000;          // 메시지 최대 글자 수
const HISTORY_LIMIT = 50;       // 한 번에 불러오는 기록 수

// 채팅 사용 여부 (관리 → 채팅 관리, settings.chat_enabled = '0' 이면 끔 — 관리자는 꺼져 있어도 들어갈 수 있음)
async function isChatEnabled(conn = pool) {
  return (await getSetting('chat_enabled', conn)) !== '0';
}

const toRoom = (r) => ({
  id: r.id,
  name: r.name,
  description: r.description || '',
  isActive: !!r.is_active,
  adminOnly: !!r.admin_only,
  sortOrder: r.sort_order,
  ...(r.message_count !== undefined ? { messageCount: Number(r.message_count) } : {}),
});

// 들어갈 수 있는 방 (관리자는 관리자 전용 방도) — all: 관리 화면용 (닫힌 방 포함, 메시지 수)
async function listRooms({ isAdmin = false, all = false } = {}, conn = pool) {
  const where = all ? '' : `WHERE is_active = 1${isAdmin ? '' : ' AND admin_only = 0'}`;
  const [rows] = await conn.query(
    `SELECT id, name, description, is_active, admin_only, sort_order
            ${all ? ', (SELECT COUNT(*) FROM chat_messages m WHERE m.room_id = chat_rooms.id AND m.is_deleted = 0) AS message_count' : ''}
       FROM chat_rooms ${where} ORDER BY sort_order, id`,
  );
  return rows.map(toRoom);
}

// 입장 가능한 방인지 확인 → 방
async function getRoomFor(user, roomId, conn = pool) {
  const [rows] = await conn.execute('SELECT id, name, description, is_active, admin_only, sort_order FROM chat_rooms WHERE id = ?', [Number(roomId) || 0]);
  const room = rows[0] && toRoom(rows[0]);
  if (!room || !room.isActive) throw new HttpError(404, '없는 채팅방입니다.');
  if (room.adminOnly && !user.isAdmin) throw new HttpError(403, '관리자만 들어갈 수 있는 방입니다.');
  return room;
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
  deleted: !!r.is_deleted,
  createdAt: r.created_at,
});

const MESSAGE_COLUMNS = 'id, room_id, user_id, author_name, author_role, type, body, data, is_deleted, created_at';

// 최근 기록 (beforeId 보다 이전 것) — 오래된 것이 앞
async function getHistory(roomId, { beforeId = null, limit = HISTORY_LIMIT } = {}, conn = pool) {
  const [rows] = await conn.query(
    `SELECT ${MESSAGE_COLUMNS} FROM chat_messages
      WHERE room_id = ?${beforeId ? ' AND id < ?' : ''} ORDER BY id DESC LIMIT ?`,
    beforeId ? [roomId, beforeId, limit] : [roomId, limit],
  );
  return rows.reverse().map(toMessage);
}

// 저장 → 저장된 메시지. user 가 없으면 시스템 메시지
async function saveMessage({ roomId, user = null, type = 'text', body = null, data = null }, conn = pool) {
  if (!/^[a-z][a-z0-9_]{0,29}$/.test(type)) throw new Error(`chat: 잘못된 메시지 type (${type})`);
  const text = body === null ? null : String(body).slice(0, MAX_BODY * 2);
  const [result] = await conn.execute(
    'INSERT INTO chat_messages (room_id, user_id, author_name, author_role, type, body, data) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [roomId, user?.id ?? null, user?.name ?? null, user?.role ?? null, type, text, data === null ? null : JSON.stringify(data)],
  );
  const [rows] = await conn.execute(`SELECT ${MESSAGE_COLUMNS} FROM chat_messages WHERE id = ?`, [result.insertId]);
  return toMessage(rows[0]);
}

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
  MAX_BODY, HISTORY_LIMIT, isChatEnabled, listRooms, getRoomFor, getHistory, saveMessage, deleteMessage, toRoom,
};
