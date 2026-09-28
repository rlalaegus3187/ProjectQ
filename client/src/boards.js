// 게시판 정보 (서버 routes/boards.js 와 같은 키)
export const BOARDS = {
  notice: { label: '공지', adminOnly: true },
  world: { label: '세계관', adminOnly: true },
  guide: { label: '캐릭터 가이드', adminOnly: true },
  qna: { label: 'Q&A', adminOnly: false },
};
export const BOARD_KEYS = Object.keys(BOARDS);
export const ADMIN_BOARD_KEYS = BOARD_KEYS.filter((k) => BOARDS[k].adminOnly);

export function formatDate(value) {
  const d = new Date(value);
  const today = new Date();
  return d.toDateString() === today.toDateString()
    ? d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString('ko-KR');
}
