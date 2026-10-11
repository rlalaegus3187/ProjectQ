-- 031_chat_rooms_members.sql : 채팅방을 회원이 만들고 가입/나가기, 마지막 사람이 나가면 방 폭파 + roomspace(공간)
--   chat_rooms.space        방이 속한 공간 = Socket.IO 네임스페이스 이름 (지금은 'chat', 나중에 'investigation'(조사) 등)
--   chat_rooms.owner_id     방장 (만든 사람, 나가면 가장 먼저 들어온 사람에게 넘어감) — users 와 FK 없음
--   chat_rooms.is_permanent 상시 방 (관리 → 채팅 관리에서 만든 방, 비어도 폭파되지 않음)
--   chat_room_members       방 가입자 — 가입한 방에만 들어가 대화, 계정을 지우면 가입도 지워짐
-- 기존 방(관리자가 만든 '일반' 등)은 상시 방으로
ALTER TABLE chat_rooms
  ADD COLUMN space VARCHAR(30) NOT NULL DEFAULT 'chat' AFTER id,
  ADD COLUMN owner_id INT UNSIGNED NULL AFTER description,
  ADD COLUMN is_permanent TINYINT(1) NOT NULL DEFAULT 0 AFTER owner_id,
  ADD KEY idx_chat_rooms_space (space, sort_order, id);
UPDATE chat_rooms SET is_permanent = 1;

CREATE TABLE IF NOT EXISTS chat_room_members (
  room_id    INT UNSIGNED NOT NULL,
  user_id    INT UNSIGNED NOT NULL,
  joined_at  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (room_id, user_id),
  KEY idx_chat_room_members_user (user_id),
  CONSTRAINT fk_chat_room_members_room FOREIGN KEY (room_id) REFERENCES chat_rooms (id) ON DELETE CASCADE,
  CONSTRAINT fk_chat_room_members_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
