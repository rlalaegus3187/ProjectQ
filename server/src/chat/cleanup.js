// 계정 삭제 뒤 채팅 정리 — 마지막 가입자가 사라진 회원 방 폭파, 방장 넘기기, 열린 채팅 화면 목록 새로고침
// (routes/auth.js 탈퇴 · routes/adminUsers.js 회원 삭제에서 부름. 실패해도 계정 삭제는 그대로)
const store = require('./store');

async function chatCleanup() {
  try {
    await store.cleanupAfterUserDelete();
    const { getChat } = require('.');
    getChat()?.roomsChanged();
  } catch (err) {
    console.error('[chat] 계정 삭제 뒤 정리 실패', err);
  }
}

module.exports = { chatCleanup };
