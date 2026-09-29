-- 012_content_pages.sql : 콘텐츠 페이지(공지 / 세계관 / 시스템 / 캐릭터 가이드) 내용
-- 페이지마다 파일을 따로 두지 않고, 내용은 여기 저장 → 관리 → 페이지 관리에서 마크다운으로 작성
-- 화면은 client/src/pages/content/ContentPage.vue 하나가 주소(slug)로 불러와 표시
CREATE TABLE IF NOT EXISTS content_pages (
  slug            VARCHAR(30)  NOT NULL,           -- 주소: /notice, /world ...
  title           VARCHAR(100) NOT NULL,
  description     VARCHAR(255) NOT NULL DEFAULT '', -- 제목 아래 한 줄 설명
  body            MEDIUMTEXT   NULL,                -- 마크다운
  music_video_id  VARCHAR(11)  NULL,                -- 이 페이지에서만 재생할 음악 (유튜브, 없으면 사이트 음악)
  sort_order      INT          NOT NULL DEFAULT 0,
  updated_by      INT UNSIGNED NULL,
  created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (slug),
  CONSTRAINT fk_content_pages_user FOREIGN KEY (updated_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO content_pages (slug, title, sort_order) VALUES
  ('notice', '공지', 10),
  ('world',  '세계관', 20),
  ('system', '시스템', 30),
  ('guide',  '캐릭터 가이드', 40);
