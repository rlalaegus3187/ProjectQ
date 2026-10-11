// 채팅 소켓 연결 (Socket.IO) — 서버 server/src/chat/index.js
//   const socket = getChatSocket();  socket.connect();  ... socket.disconnect();
//   const data = await request('room:enter', { roomId });   // 서버 ack 의 { error } 는 throw
// 공간(roomspace)마다 네임스페이스 하나 — 기본 'chat', 다른 공간은 getChatSocket('investigation') · request(이벤트, 값, 'investigation')
// 로그인 세션 쿠키로 인증 → 채팅 화면에 있는 동안만 연결 (로그인/로그아웃이 바뀌어도 새로 연결하면 반영)
import { io } from 'socket.io-client';

export const SOCKET_PATH = '/api/socket.io';
const sockets = new Map();

export function getChatSocket(space = 'chat') {
  if (!sockets.has(space)) sockets.set(space, io(`/${space}`, { path: SOCKET_PATH, autoConnect: false, withCredentials: true }));
  return sockets.get(space);
}

// 응답(ack)을 기다리는 요청 — 10초 안에 답이 없으면 오류
export async function request(event, payload = {}, space = 'chat') {
  let res;
  try {
    res = await getChatSocket(space).timeout(10000).emitWithAck(event, payload);
  } catch {
    throw new Error('서버 응답이 없습니다. 연결 상태를 확인해주세요.');
  }
  if (res?.error) throw new Error(res.error);
  return res;
}
