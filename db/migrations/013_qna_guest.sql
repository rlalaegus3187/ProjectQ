-- 013_qna_guest.sql : Q&A 비회원 글 + 글 비밀번호
--   user_id        비회원 글이면 NULL
--   guest_name     비회원 작성자 이름
--   password_hash  글 비밀번호 (scrypt). 비회원 글은 필수(수정·삭제·비밀글 보기),
--                  회원 비밀글은 선택(비밀번호를 아는 사람도 볼 수 있게)
-- 비회원 글쓰기 허용 여부는 settings.qna_guest_write ('1' 허용 / 없으면 막음) — 관리 → 사이트 설정
ALTER TABLE posts
  MODIFY COLUMN user_id INT UNSIGNED NULL,
  ADD COLUMN guest_name VARCHAR(50) NULL AFTER user_id,
  ADD COLUMN password_hash VARCHAR(255) NULL AFTER is_pinned;
