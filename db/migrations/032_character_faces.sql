-- 032_character_faces.sql : 캐릭터 표정(두상) — 채팅에서 표정을 골라 말하면 메시지 옆에 그 표정 이미지가 보임
--   character_faces  캐릭터별 표정 여러 개 (마이페이지 → 표정에서 등록)
--     seq   캐릭터 안 번호 (1, 2, 3 … 자동)
--     code  '<캐릭터 id>_<seq>' (예: 3_1, 3_2) — 표정 고유 이름, 자동으로 만들어짐
--     name  표정 이름 (예: 기본, 웃음, 화남), image 이미지 (올린 파일 또는 링크)
--   chat_messages.face_id  그 메시지를 말할 때 고른 표정 (기록을 볼 때도 이 id 로 이미지를 찾아 보여줌)
--                          표정을 지우면 NULL (메시지는 남고 두상만 기본 모양)
--   chat_messages.edited_at 메시지를 고친 시각 (NULL = 고친 적 없음)
CREATE TABLE IF NOT EXISTS character_faces (
  id            INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  character_id  INT UNSIGNED  NOT NULL,
  seq           INT UNSIGNED  NOT NULL,
  code          VARCHAR(40)   NOT NULL,
  name          VARCHAR(30)   NOT NULL,
  image         VARCHAR(1000) NOT NULL,
  created_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_character_faces_code (code),
  UNIQUE KEY uq_character_faces_seq (character_id, seq),
  CONSTRAINT fk_character_faces_character FOREIGN KEY (character_id) REFERENCES characters (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE chat_messages
  ADD COLUMN face_id INT UNSIGNED NULL AFTER author_role,
  ADD COLUMN edited_at DATETIME NULL AFTER is_deleted,
  ADD CONSTRAINT fk_chat_messages_face FOREIGN KEY (face_id) REFERENCES character_faces (id) ON DELETE SET NULL;
