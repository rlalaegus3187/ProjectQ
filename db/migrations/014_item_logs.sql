-- 014_item_logs.sql : 아이템 습득/사용 기록 (아이템별 언제·어디서 얻었는지)
-- inventory 는 지금 보유 수량(아이템별 한 줄), item_logs 는 들어오고 나간 모든 기록
--   amount          + 습득 / - 버림·회수·사용
--   quantity_after  기록 후 보유 수량
--   source          어디서: admin(관리자 지급), shop(상점 구매), admin_take(관리자 회수), discard(버림),
--                   legacy(이 기록 기능 전부터 갖고 있던 것) ... — 새 획득처는 코드에서 자유롭게 추가 (영문 30자)
--   memo            상세 (예: '1차 이벤트 보상', 상점 구매 가격)
--   actor_user_id   처리한 회원 (관리자 지급이면 그 관리자, 본인이 버리면 본인)
CREATE TABLE IF NOT EXISTS item_logs (
  id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  character_id    INT UNSIGNED NOT NULL,
  item_id         INT UNSIGNED NOT NULL,
  amount          INT          NOT NULL,
  quantity_after  INT UNSIGNED NOT NULL,
  source          VARCHAR(30)  NOT NULL,
  memo            VARCHAR(255) NULL,
  actor_user_id   INT UNSIGNED NULL,
  created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_item_logs_character (character_id, id),
  KEY idx_item_logs_character_item (character_id, item_id, id),
  KEY idx_item_logs_item (item_id),
  CONSTRAINT fk_item_logs_character FOREIGN KEY (character_id) REFERENCES characters (id) ON DELETE CASCADE,
  CONSTRAINT fk_item_logs_item      FOREIGN KEY (item_id)      REFERENCES items (id)      ON DELETE CASCADE,
  CONSTRAINT fk_item_logs_actor     FOREIGN KEY (actor_user_id) REFERENCES users (id)    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 마지막으로 얻은 시각 (acquired_at 은 처음 얻은 시각)
ALTER TABLE inventory
  ADD COLUMN last_acquired_at DATETIME NULL AFTER acquired_at;
UPDATE inventory SET last_acquired_at = acquired_at WHERE last_acquired_at IS NULL;

-- 지금 갖고 있는 아이템은 '기록 시작 전부터 보유'로 한 줄씩 남김
INSERT INTO item_logs (character_id, item_id, amount, quantity_after, source, memo, created_at)
SELECT character_id, item_id, quantity, quantity, 'legacy', '기록 시작 전부터 보유', acquired_at FROM inventory;
