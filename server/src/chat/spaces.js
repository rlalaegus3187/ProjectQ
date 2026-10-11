// 채팅 공간(roomspace) 목록 — 공간마다 Socket.IO 네임스페이스(/<name>) 하나, 방(chat_rooms.space)·명령어·모듈이 따로
//   name       네임스페이스 · chat_rooms.space 값 (영문 소문자)
//   label      화면에 보이는 이름
//   modulesDir 그 공간의 서버 모듈 폴더 (*.js 자동, _ 로 시작하면 건너뜀)
//
// 새 공간 추가 (예: 조사 전용):
//   { name: 'investigation', label: '조사', modulesDir: path.join(__dirname, 'investigation') },
//   → 화면은 io('/investigation', { path: '/api/socket.io' }) 로 연결 (client/src/chat/socket.js 의 getChatSocket('investigation'))
const path = require('path');

module.exports = [
  { name: 'chat', label: '채팅', modulesDir: path.join(__dirname, 'modules') },
];
