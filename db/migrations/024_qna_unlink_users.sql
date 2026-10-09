-- 024_qna_unlink_users.sql : Q&A 글·답변을 계정(users)과 DB 로 연결하지 않음
--   지금까지는 계정을 지우면 그 사람의 글·답변도 함께 삭제됐음(FK CASCADE) → 계정을 지워도 글은 그대로 남도록
--   author_name : 글/답변을 쓸 때의 이름을 글에 직접 저장 (회원은 아이디, 비회원은 입력한 이름)
--   user_id     : 쓴 회원 번호 (작성자 확인·답변 알림용). 계정을 지우면 NULL 로 비움 — 글은 남고 '탈퇴한 회원' 글이 됨
ALTER TABLE posts ADD COLUMN author_name VARCHAR(50) NULL AFTER guest_name;
UPDATE posts p LEFT JOIN users u ON u.id = p.user_id SET p.author_name = COALESCE(u.username, p.guest_name), p.updated_at = p.updated_at;   -- '수정됨' 표시가 생기지 않게
ALTER TABLE posts DROP FOREIGN KEY fk_posts_user;

ALTER TABLE post_replies ADD COLUMN author_name VARCHAR(50) NULL AFTER user_id;
UPDATE post_replies r LEFT JOIN users u ON u.id = r.user_id SET r.author_name = u.username, r.updated_at = r.updated_at;
ALTER TABLE post_replies DROP FOREIGN KEY fk_replies_user, MODIFY COLUMN user_id INT UNSIGNED NULL;
