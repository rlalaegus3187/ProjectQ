-- 005_boards.sql : 게시판(공지 / 세계관 / 캐릭터 가이드 / Q&A) + Q&A 답변 + 계정별 알림
--   board     notice(공지) / world(세계관) / guide(캐릭터 가이드) : 관리자만 작성
--             qna(Q&A) : 로그인한 회원 작성, 관리자 답변
--             free : 이전 샘플 게시판 글 (화면에는 표시하지 않음)
--   is_hidden Q&A 비밀글 (작성자와 관리자만 볼 수 있음)
--   is_pinned Q&A 메인 글 (목록 상단 고정, 관리자만 지정)
ALTER TABLE posts
  ADD COLUMN board ENUM('free', 'notice', 'world', 'guide', 'qna') NOT NULL DEFAULT 'free' AFTER id,
  MODIFY body MEDIUMTEXT NULL,
  ADD COLUMN is_hidden TINYINT(1) NOT NULL DEFAULT 0 AFTER body,
  ADD COLUMN is_pinned TINYINT(1) NOT NULL DEFAULT 0 AFTER is_hidden,
  ADD COLUMN updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at,
  ADD KEY idx_posts_board (board, is_pinned, id);

-- Q&A 답변 (관리자 작성)
CREATE TABLE IF NOT EXISTS post_replies (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  post_id     INT UNSIGNED NOT NULL,
  user_id     INT UNSIGNED NOT NULL,
  body        MEDIUMTEXT   NOT NULL,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_replies_post (post_id),
  CONSTRAINT fk_replies_post FOREIGN KEY (post_id) REFERENCES posts (id) ON DELETE CASCADE,
  CONSTRAINT fk_replies_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 계정별 알림 (예: 내 Q&A 질문에 답변이 달림)
CREATE TABLE IF NOT EXISTS notifications (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id     INT UNSIGNED NOT NULL,
  type        VARCHAR(30)  NOT NULL,
  post_id     INT UNSIGNED NULL,
  message     VARCHAR(255) NOT NULL,
  is_read     TINYINT(1)   NOT NULL DEFAULT 0,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_notifications_user (user_id, is_read, id),
  CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_notifications_post FOREIGN KEY (post_id) REFERENCES posts (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
