-- 034_chat_room_on_character.sql : 채팅방은 한 번에 한 방만 가입 — 지금 가입한 방을 캐릭터에 저장
--   characters.chat_room_id    지금 가입한 채팅방 (가입 안 했으면 NULL) — 칸이 하나라 두 방에 동시에 가입할 수 없음
--   characters.chat_joined_at  가입한 시각 (방장이 나가면 가장 먼저 들어온 사람이 방장)
--   방이 지워지면(폭파·삭제) chat_room_id 는 자동으로 NULL, 캐릭터(계정)를 지우면 그 방에서 빠짐
--   chat_room_members (031) 는 없앰 — 여러 방에 가입돼 있던 사람은 가장 최근에 가입한 방 하나만 남김
ALTER TABLE characters
  ADD COLUMN chat_room_id INT UNSIGNED NULL,
  ADD COLUMN chat_joined_at DATETIME(3) NULL,
  ADD KEY idx_characters_chat_room (chat_room_id, chat_joined_at),
  ADD CONSTRAINT fk_characters_chat_room FOREIGN KEY (chat_room_id) REFERENCES chat_rooms (id) ON DELETE SET NULL;

UPDATE characters c
  JOIN (
    SELECT m.user_id, m.room_id, m.joined_at,
           ROW_NUMBER() OVER (PARTITION BY m.user_id ORDER BY m.joined_at DESC, m.room_id DESC) AS rn
      FROM chat_room_members m JOIN chat_rooms r ON r.id = m.room_id AND r.space = 'chat'
  ) last ON last.user_id = c.user_id AND last.rn = 1
   SET c.chat_room_id = last.room_id, c.chat_joined_at = last.joined_at;

DROP TABLE chat_room_members;

-- 아무도 남지 않은 회원 방은 폭파, 방장이 빠진 방은 가장 먼저 들어온 사람에게
DELETE r FROM chat_rooms r
 WHERE r.is_permanent = 0 AND NOT EXISTS (SELECT 1 FROM characters c WHERE c.chat_room_id = r.id);
UPDATE chat_rooms r
   SET r.owner_id = (SELECT c.user_id FROM characters c WHERE c.chat_room_id = r.id ORDER BY c.chat_joined_at, c.id LIMIT 1)
 WHERE r.is_permanent = 0
   AND NOT EXISTS (SELECT 1 FROM characters c WHERE c.chat_room_id = r.id AND c.user_id = r.owner_id);
