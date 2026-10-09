// 회원 계정 공용: 아이디·비밀번호·소통 계정 검증, 세션 정리
const pool = require('./db');
const { HttpError } = require('./errors');

// 아이디: 영문·숫자·_ 4~20자 (대소문자 구분 없이 중복 불가 — DB collation), 가입 후 바꿀 수 없음
const USERNAME_RE = /^[A-Za-z0-9_]{4,20}$/;
const PASSWORD_MIN = 8;
const PASSWORD_MAX = 100;
const CONTACT_MAX = 100;

function parseUsername(value) {
  const username = String(value ?? '').trim();
  if (!USERNAME_RE.test(username)) throw new HttpError(400, '아이디는 영문·숫자·_ 로 4~20자여야 합니다.');
  return username;
}

function parseNewPassword(value, label = '비밀번호') {
  const password = String(value ?? '');
  if (password.length < PASSWORD_MIN || password.length > PASSWORD_MAX) {
    throw new HttpError(400, `${label}는 ${PASSWORD_MIN}~${PASSWORD_MAX}자로 입력해주세요.`);
  }
  return password;
}

// 소통 계정 (예: 트위터 @id, 디스코드 아이디) — 필수
function parseContact(value) {
  const contact = String(value ?? '').trim();
  if (!contact || contact.length > CONTACT_MAX) throw new HttpError(400, `소통 계정은 1~${CONTACT_MAX}자로 입력해주세요.`);
  return contact;
}

// 그 회원의 로그인 세션을 모두 끊음 (비밀번호가 바뀌면 다른 기기에서 로그아웃)
// exceptSessionId: 지금 쓰는 세션은 남김
async function destroyUserSessions(userId, exceptSessionId = null, conn = pool) {
  await conn.execute(
    `DELETE FROM sessions
      WHERE JSON_VALID(data) AND JSON_EXTRACT(data, '$.userId') = ?
        AND session_id <> ?`,
    [Number(userId), exceptSessionId ?? ''],
  );
}

// 계정을 지우기 전에: 그 사람이 쓴 Q&A 글·답변은 남기고 계정 연결(user_id)만 비움 (글에는 쓸 때의 이름이 저장돼 있음)
// updated_at 은 그대로 (글이 '수정됨'으로 보이지 않게)
async function detachUserPosts(conn, userIds) {
  if (!userIds.length) return;
  await conn.query('UPDATE posts SET user_id = NULL, updated_at = updated_at WHERE user_id IN (?)', [userIds]);
  await conn.query('UPDATE post_replies SET user_id = NULL, updated_at = updated_at WHERE user_id IN (?)', [userIds]);
}

module.exports = {
  detachUserPosts,
  USERNAME_RE, PASSWORD_MIN, parseUsername, parseNewPassword, parseContact, destroyUserSessions,
};
