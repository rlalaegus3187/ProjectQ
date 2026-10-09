-- 025_item_effects.sql : 아이템 효과 종류를 관리 화면에서 추가·수정·삭제 (지금까지는 DB ENUM 으로 고정)
--   item_effects  code(프로그램용 키, 영문 소문자·숫자·_) · label(화면 이름) · example(효과수치 JSON 예시) · description(설명)
--   items.effect  → item_effects.code (FK — 아이템이 쓰는 효과는 바로 지울 수 없음, 관리 화면은 '효과 없음'으로 바꾼 뒤 삭제)
--   'none'(효과 없음)은 기본 효과라 지울 수 없음
CREATE TABLE IF NOT EXISTS item_effects (
  code         VARCHAR(30)  NOT NULL,
  label        VARCHAR(50)  NOT NULL,
  example      VARCHAR(500) NOT NULL DEFAULT '{}',
  description  VARCHAR(255) NULL,
  sort_order   INT          NOT NULL DEFAULT 0,
  created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO item_effects (code, label, example, description, sort_order) VALUES
  ('none',       '효과 없음', '{}',                     '사용해도 아무 일도 일어나지 않는 아이템', 0),
  ('hp_recover', 'HP 회복',  '{"amount": 50}',         NULL, 10),
  ('stat_bonus', '스탯 증가', '{"str": 2, "int": 1}',   NULL, 20),
  ('custom',     '기타',     '{"note": "설명"}',        '자유 형식', 30);

ALTER TABLE items MODIFY COLUMN effect VARCHAR(30) NOT NULL DEFAULT 'none';
ALTER TABLE items
  ADD CONSTRAINT fk_items_effect FOREIGN KEY (effect) REFERENCES item_effects (code) ON UPDATE CASCADE;
