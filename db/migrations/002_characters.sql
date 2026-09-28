-- 002_characters.sql : 회원 권한(관리자/일반) + 캐릭터(기본정보/스탯/세부정보) + 수집 항목 정의

-- 회원 권한. 가입 시 어떤 권한을 줄지는 서버 설정(SIGNUP_ROLE, 기본 admin)에서 결정
ALTER TABLE users
  ADD COLUMN role ENUM('admin', 'user') NOT NULL DEFAULT 'user' AFTER name;
-- 현재는 "가입하면 모두 관리자" 정책이므로 기존 회원도 관리자로
UPDATE users SET role = 'admin';

-- 캐릭터 스탯/세부정보로 "무엇을 수집할지" 정의하는 테이블 (관리자 페이지에서 추가/수정)
--   category   : stat(스탯, 정수값) / detail(세부정보)
--   code       : 프로그램에서 쓰는 키 (영문 소문자, 변경 불가)
--   label      : 화면에 보이는 이름
--   value_type : number / text  (스탯은 항상 number)
--   is_active  : 0 이면 입력/표시에서 숨김 (기존 값은 보존)
CREATE TABLE IF NOT EXISTS attribute_definitions (
  id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  category     ENUM('stat', 'detail') NOT NULL,
  code         VARCHAR(50)  NOT NULL,
  label        VARCHAR(100) NOT NULL,
  value_type   ENUM('number', 'text') NOT NULL DEFAULT 'text',
  is_required  TINYINT(1)   NOT NULL DEFAULT 0,
  sort_order   INT          NOT NULL DEFAULT 0,
  is_active    TINYINT(1)   NOT NULL DEFAULT 1,
  created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_attr_category_code (category, code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 캐릭터 기본정보 (계정당 1개: user_id UNIQUE)
CREATE TABLE IF NOT EXISTS characters (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id     INT UNSIGNED NOT NULL,
  name        VARCHAR(50)  NOT NULL,
  hp          INT          NOT NULL DEFAULT 0,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_characters_user (user_id),
  CONSTRAINT fk_characters_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 캐릭터 스탯 값 (항목 = attribute_definitions.category = 'stat')
CREATE TABLE IF NOT EXISTS character_stats (
  character_id   INT UNSIGNED NOT NULL,
  definition_id  INT UNSIGNED NOT NULL,
  value          INT          NOT NULL,
  updated_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (character_id, definition_id),
  CONSTRAINT fk_cstats_character  FOREIGN KEY (character_id)  REFERENCES characters (id) ON DELETE CASCADE,
  CONSTRAINT fk_cstats_definition FOREIGN KEY (definition_id) REFERENCES attribute_definitions (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 캐릭터 세부정보 값 (항목 = attribute_definitions.category = 'detail')
CREATE TABLE IF NOT EXISTS character_details (
  character_id   INT UNSIGNED NOT NULL,
  definition_id  INT UNSIGNED NOT NULL,
  value          TEXT         NOT NULL,
  updated_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (character_id, definition_id),
  CONSTRAINT fk_cdetails_character  FOREIGN KEY (character_id)  REFERENCES characters (id) ON DELETE CASCADE,
  CONSTRAINT fk_cdetails_definition FOREIGN KEY (definition_id) REFERENCES attribute_definitions (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 기본 세부정보 항목 (스탯 항목은 나중에 관리자 페이지에서 추가)
INSERT IGNORE INTO attribute_definitions (category, code, label, value_type, sort_order) VALUES
  ('detail', 'original_name', '원문 이름', 'text',   10),
  ('detail', 'age',           '나이',      'number', 20);
