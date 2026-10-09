-- 027_titles.sql : 칭호(타이틀) — 관리자가 만들고 캐릭터에게 부여, 캐릭터는 그중 하나를 대표 칭호로 표시
--   titles            칭호 목록 (관리 → 칭호 관리 → 칭호 목록)  name · description · color(배지 색, #rrggbb) · sort_order
--   character_titles  캐릭터가 가진 칭호 (관리 → 칭호 관리 → 칭호 부여)  memo(부여 사유) · granted_by(부여한 관리자 회원 번호)
--   characters.main_title_id  대표 칭호 (마이페이지에서 고름, 이름 옆에 표시) — 칭호를 지우거나 회수하면 비워짐
CREATE TABLE IF NOT EXISTS titles (
  id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name         VARCHAR(50)  NOT NULL,
  description  VARCHAR(500) NULL,
  color        CHAR(7)      NULL,                -- 배지 색 (#rrggbb), 없으면 기본 색
  sort_order   INT          NOT NULL DEFAULT 0,
  created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_titles_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS character_titles (
  character_id INT UNSIGNED NOT NULL,
  title_id     INT UNSIGNED NOT NULL,
  memo         VARCHAR(100) NULL,
  granted_by   INT UNSIGNED NULL,                -- 부여한 관리자 (계정과 FK 로 묶지 않음)
  granted_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (character_id, title_id),
  KEY idx_character_titles_title (title_id),
  CONSTRAINT fk_character_titles_character FOREIGN KEY (character_id) REFERENCES characters (id) ON DELETE CASCADE,
  CONSTRAINT fk_character_titles_title FOREIGN KEY (title_id) REFERENCES titles (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE characters
  ADD COLUMN main_title_id INT UNSIGNED NULL AFTER name,
  ADD CONSTRAINT fk_characters_main_title FOREIGN KEY (main_title_id) REFERENCES titles (id) ON DELETE SET NULL;
