// 새 화면 모듈 빈 틀 — 복사해서 이름을 바꾸면(예: modules/attendance.js) 자동으로 붙음 (_ 로 시작하면 안 불러옴)
// 서버 모듈이 { type: 'attendance', body, data } 메시지를 보내면, 여기 등록한 컴포넌트가 그 메시지를 그림
//   컴포넌트는 props 로 message 하나를 받음: { id, type, author, body, data, createdAt, ... }
// import AttendanceMessage from './AttendanceMessage.vue';
export default {
  name: 'template',
  messageTypes: {
    // attendance: AttendanceMessage,
  },
};
