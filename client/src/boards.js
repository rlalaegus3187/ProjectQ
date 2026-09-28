// 게시판 정보 (서버 routes/boards.js 와 같은 키) — 현재는 Q&A 만 게시판
export const BOARDS = {
  qna: { label: 'Q&A', adminOnly: false },
};

export function formatDate(value) {
  const d = new Date(value);
  const today = new Date();
  return d.toDateString() === today.toDateString()
    ? d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString('ko-KR');
}
