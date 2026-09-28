// 알림 보내기 — 서버 어디서든 불러 쓰는 공용 함수 (notifications 테이블에 추가)
//
//   const { notify, notifyUsers, notifyAdmins } = require('../notify');
//
//   // 한 명에게
//   await notify({ userId: 3, message: '캐릭터 승인이 완료되었습니다.', link: '/mypage' });
//
//   // 게시글 관련 알림 (link 를 생략하면 글 주소로 이동: /<게시판>/<글번호>)
//   await notify({ userId: post.user_id, type: 'qna_reply', postId: post.id, message: '답변이 달렸습니다.' });
//
//   // 여러 명 / 관리자 전체에게
//   await notifyUsers([1, 2, 3], { type: 'event', message: '이벤트가 시작되었습니다.', link: '/notice' });
//   await notifyAdmins({ type: 'qna_new', message: '새 질문이 올라왔습니다.', postId: 7 }, { exceptUserId: 5 });
//
//   // 트랜잭션 안에서는 마지막 인자로 커넥션을 넘기면 같이 커밋/롤백됨
//   await withTransaction(async (conn) => { ...; await notify({ ... }, conn); });
//
// 옵션
//   userId   받을 회원 id (필수, notify)
//   message  알림 문구 (필수, 255자 초과분은 잘림)
//   type     알림 종류 (영문 30자 이내, 기본 'general') — 나중에 종류별 표시/필터용
//   postId   관련 게시글 id (게시글이 삭제되면 알림도 함께 삭제됨)
//   link     눌렀을 때 이동할 사이트 내부 주소 ('/' 로 시작). 없으면 postId 로 글 주소를 만듦
const pool = require('./db');

const MAX_MESSAGE = 255;
const TYPE_RE = /^[a-z][a-z0-9_]{0,29}$/;

function toRow(userId, { message, type = 'general', postId = null, link = null } = {}) {
  const id = Number(userId);
  if (!Number.isInteger(id) || id <= 0) throw new Error(`notify: 잘못된 userId (${userId})`);
  const text = String(message ?? '').trim();
  if (!text) throw new Error('notify: message 가 비어 있습니다.');
  if (!TYPE_RE.test(type)) throw new Error(`notify: type 은 영문 소문자/숫자/_ 30자 이내여야 합니다 (${type})`);
  // 외부 사이트로 보내는 링크(피싱 등)를 막기 위해 사이트 내부 주소만 허용
  if (link !== null && !(typeof link === 'string' && link.startsWith('/') && !link.startsWith('//') && link.length <= 255)) {
    throw new Error(`notify: link 는 '/' 로 시작하는 사이트 내부 주소여야 합니다 (${link})`);
  }
  const trimmed = text.length > MAX_MESSAGE ? `${text.slice(0, MAX_MESSAGE - 1)}…` : text;
  return [id, type, postId === null ? null : Number(postId), link, trimmed];
}

// 여러 명에게 같은 알림 → 추가된 개수
async function notifyUsers(userIds, options, conn = pool) {
  const ids = [...new Set((userIds || []).map(Number))];
  if (!ids.length) return 0;
  const rows = ids.map((id) => toRow(id, options));
  const [result] = await conn.query(
    'INSERT INTO notifications (user_id, type, post_id, link, message) VALUES ?',
    [rows],
  );
  return result.affectedRows;
}

// 한 명에게 → 추가된 알림 id
async function notify({ userId, ...options }, conn = pool) {
  const [result] = await conn.execute(
    'INSERT INTO notifications (user_id, type, post_id, link, message) VALUES (?, ?, ?, ?, ?)',
    toRow(userId, options),
  );
  return result.insertId;
}

// 관리자 전체에게 (exceptUserId: 제외할 회원, 예: 본인이 한 행동) → 추가된 개수
async function notifyAdmins(options, { exceptUserId = null } = {}, conn = pool) {
  const [admins] = await conn.query("SELECT id FROM users WHERE role = 'admin'");
  const ids = admins.map((a) => a.id).filter((id) => id !== exceptUserId);
  return notifyUsers(ids, options, conn);
}

module.exports = { notify, notifyUsers, notifyAdmins };
