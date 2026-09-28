-- 009_money_shop.sql : 소지금(캐릭터 귀속) + 소지금 내역 + 상점

-- 소지금 (캐릭터당 1개)
ALTER TABLE characters
  ADD COLUMN money BIGINT UNSIGNED NOT NULL DEFAULT 0 AFTER hp;

-- 소지금 내역 (들어오고 나간 기록)
--   amount  변화량 (+ 들어옴 / - 나감), balance 변화 후 잔액
--   reason  admin(관리자 지급/회수), shop_buy(상점 구매) ... — 새 사유는 코드에서 자유롭게 추가
CREATE TABLE IF NOT EXISTS money_logs (
  id            INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  character_id  INT UNSIGNED    NOT NULL,
  amount        BIGINT          NOT NULL,
  balance       BIGINT UNSIGNED NOT NULL,
  reason        VARCHAR(30)     NOT NULL,
  memo          VARCHAR(255)    NULL,
  created_at    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_money_logs_character (character_id, id),
  CONSTRAINT fk_money_logs_character FOREIGN KEY (character_id) REFERENCES characters (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 상점 상품 (등록된 아이템을 골라 가격을 붙여 판매, 아이템당 1개)
--   stock NULL = 무제한
CREATE TABLE IF NOT EXISTS shop_items (
  id          INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  item_id     INT UNSIGNED    NOT NULL,
  price       BIGINT UNSIGNED NOT NULL,
  stock       INT UNSIGNED    NULL,
  is_active   TINYINT(1)      NOT NULL DEFAULT 1,
  sort_order  INT             NOT NULL DEFAULT 0,
  created_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_shop_items_item (item_id),
  CONSTRAINT fk_shop_items_item FOREIGN KEY (item_id) REFERENCES items (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
