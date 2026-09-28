-- 007_items_inventory.sql : 아이템(마스터) + 캐릭터 인벤토리
--
-- effect (효과 종류)          effect_values (효과수치, JSON 예)
--   none       효과 없음        {}
--   hp_recover HP 회복          {"amount": 50}
--   stat_bonus 스탯 증가        {"str": 2, "int": 1}
--   custom     기타(자유 형식)  {"note": "..."}
-- 효과 종류를 바꾸려면 새 마이그레이션에서 ALTER TABLE items MODIFY effect ENUM(...) 로 변경
CREATE TABLE IF NOT EXISTS items (
  id             INT UNSIGNED NOT NULL AUTO_INCREMENT,           -- 아이템 uid
  name           VARCHAR(100) NOT NULL,
  description    TEXT         NULL,                              -- 마크다운
  small_image    VARCHAR(255) NULL,                              -- 업로드 경로 (/api/uploads/...)
  large_image    VARCHAR(255) NULL,
  effect         ENUM('none', 'hp_recover', 'stat_bonus', 'custom') NOT NULL DEFAULT 'none',
  effect_values  JSON         NULL,
  is_bound       TINYINT(1)   NOT NULL DEFAULT 0,                -- 귀속 (1 이면 다른 캐릭터에게 넘길 수 없음)
  is_sellable    TINYINT(1)   NOT NULL DEFAULT 1,                -- 판매 가능
  created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_items_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 캐릭터가 가진 아이템 (같은 아이템은 한 줄에 수량으로 쌓임)
CREATE TABLE IF NOT EXISTS inventory (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  character_id  INT UNSIGNED NOT NULL,
  item_id       INT UNSIGNED NOT NULL,
  quantity      INT UNSIGNED NOT NULL DEFAULT 1,
  acquired_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,   -- 처음 얻은 시각
  updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_inventory_character_item (character_id, item_id),
  KEY idx_inventory_item (item_id),
  CONSTRAINT fk_inventory_character FOREIGN KEY (character_id) REFERENCES characters (id) ON DELETE CASCADE,
  CONSTRAINT fk_inventory_item      FOREIGN KEY (item_id)      REFERENCES items (id)      ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
