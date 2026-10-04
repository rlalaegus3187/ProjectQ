-- 016_username_login.sql : 이메일 대신 아이디로 로그인, 회원 이름·이메일 삭제, 소통 계정 추가
--   username  로그인 아이디 (영문·숫자·_ 4~20자, 대소문자 구분 없이 중복 불가, 바꿀 수 없음)
--   contact   소통 계정 (예: 트위터 @id, 디스코드 아이디) — 회원가입 때 입력, 마이페이지에서 수정
-- 기존 회원의 아이디 = 이메일 @ 앞부분 (영문·숫자·_ 만 남김). 너무 짧으면 user<번호>, 겹치면 뒤에 _<번호>
--   → 적용 후 확인: SELECT id, username, role FROM users;
ALTER TABLE users
  ADD COLUMN username VARCHAR(30)  NULL AFTER id,
  ADD COLUMN contact  VARCHAR(100) NULL AFTER username;

UPDATE users
   SET username = LEFT(REGEXP_REPLACE(SUBSTRING_INDEX(email, '@', 1), '[^A-Za-z0-9_]', ''), 15)
 WHERE username IS NULL;
UPDATE users SET username = CONCAT('user', id) WHERE CHAR_LENGTH(username) < 4;
-- 겹치는 아이디: 가장 먼저 가입한 회원만 그대로, 나머지는 _<번호>
UPDATE users u
  JOIN (SELECT username, MIN(id) AS keep_id FROM users GROUP BY username HAVING COUNT(*) > 1) d
    ON d.username = u.username AND u.id <> d.keep_id
   SET u.username = CONCAT(u.username, '_', u.id);

ALTER TABLE users
  MODIFY COLUMN username VARCHAR(30) NOT NULL,
  ADD UNIQUE KEY uq_users_username (username),
  DROP COLUMN email,
  DROP COLUMN name;
