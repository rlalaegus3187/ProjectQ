-- 028_chat.sql : 채팅(Socket.IO) — 채팅방 + 메시지 (server/src/chat/)
--   chat_rooms     채팅방  name · description · is_active(0 = 닫힘, 목록에서 숨김) · admin_only(관리자만 입장) · sort_order
--   chat_messages  메시지  type: text(일반) / system(입장 안내 등) / 모듈이 만든 종류(dice 등)
--                  user_id 는 users 와 FK 로 묶지 않음 → 계정을 지워도 대화 기록은 남음 (author_name 에 쓸 때의 이름)
--                  data: 모듈이 쓰는 추가 값(JSON), is_deleted: 삭제된 메시지 ('삭제된 메시지입니다'로 표시)
--   채팅 사용 여부는 settings.chat_enabled ('0' = 끔, 관리 → 채팅 관리)
CREATE TABLE IF NOT EXISTS chat_rooms (
  id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name         VARCHAR(50)  NOT NULL,
  description  VARCHAR(255) NULL,
  is_active    TINYINT(1)   NOT NULL DEFAULT 1,
  admin_only   TINYINT(1)   NOT NULL DEFAULT 0,
  sort_order   INT          NOT NULL DEFAULT 0,
  created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS chat_messages (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  room_id      INT UNSIGNED NOT NULL,
  user_id      INT UNSIGNED NULL,
  author_name  VARCHAR(50)  NULL,
  author_role  VARCHAR(20)  NULL,
  type         VARCHAR(30)  NOT NULL DEFAULT 'text',
  body         TEXT         NULL,
  data         JSON         NULL,
  is_deleted   TINYINT(1)   NOT NULL DEFAULT 0,
  created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_chat_messages_room (room_id, id),
  CONSTRAINT fk_chat_messages_room FOREIGN KEY (room_id) REFERENCES chat_rooms (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO chat_rooms (name, description, sort_order)
SELECT '일반', '자유롭게 이야기하는 방', 10 FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM chat_rooms);
