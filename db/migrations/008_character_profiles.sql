-- 008_character_profiles.sql : 캐릭터 프로필 여러 개
-- 캐릭터(기본정보·스탯·인벤토리)는 그대로 1개, 프로필 양식 값(character_details)만 프로필별로 여러 세트
--
--   characters ─┬─ character_stats      (그대로)
--               └─ character_profiles   (여러 개, is_main = 대표 프로필 1개)
--                    └─ character_details (profile_id 기준으로 변경)

CREATE TABLE IF NOT EXISTS character_profiles (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  character_id  INT UNSIGNED NOT NULL,
  name          VARCHAR(50)  NOT NULL,                 -- 프로필 이름 (예: 기본 프로필, 과거 모습)
  is_main       TINYINT(1)   NOT NULL DEFAULT 0,       -- 대표 프로필 (캐릭터당 1개, 앱에서 보장)
  sort_order    INT          NOT NULL DEFAULT 0,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_profiles_character (character_id, is_main),
  CONSTRAINT fk_profiles_character FOREIGN KEY (character_id) REFERENCES characters (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 기존 캐릭터마다 대표 프로필 1개 생성
INSERT INTO character_profiles (character_id, name, is_main)
SELECT id, '기본 프로필', 1 FROM characters;

-- 기존 프로필 값을 대표 프로필로 옮기고, character_id → profile_id 로 교체
ALTER TABLE character_details ADD COLUMN profile_id INT UNSIGNED NULL FIRST;

UPDATE character_details d
  JOIN character_profiles p ON p.character_id = d.character_id AND p.is_main = 1
   SET d.profile_id = p.id;

ALTER TABLE character_details DROP FOREIGN KEY fk_cdetails_character;

ALTER TABLE character_details
  DROP PRIMARY KEY,
  DROP COLUMN character_id,
  MODIFY profile_id INT UNSIGNED NOT NULL,
  ADD PRIMARY KEY (profile_id, definition_id),
  ADD CONSTRAINT fk_cdetails_profile FOREIGN KEY (profile_id) REFERENCES character_profiles (id) ON DELETE CASCADE;
