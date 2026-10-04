-- 019_content_sections_menu.sql : 콘텐츠 페이지의 소탭(섹션) + 상단 메뉴 구성
--
-- content_sections : 페이지 안의 소탭. 페이지 화면 왼쪽에 소탭 목록, 오른쪽에 순서대로 내용 (누르면 그 소탭으로 스크롤)
--   page_slug → content_pages.slug (페이지를 지우면 소탭도 함께 삭제)
-- 지금까지 페이지 하나에 쓰던 내용(content_pages.body)은 첫 소탭 '개요'로 옮김 (body 칸은 더 이상 쓰지 않음)
--
-- 상단 메뉴: settings.site_menu (JSON) = [{ "key": "page:notice", "visible": true }, { "key": "members", ... }]
--   key: page:<slug>(콘텐츠 페이지) / members / shop / qna — 순서 = 메뉴 순서. 관리 → 메뉴 관리에서 설정
--   저장된 게 없으면 모든 페이지 + 멤버·상점·Q&A 가 보임
CREATE TABLE IF NOT EXISTS content_sections (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  page_slug   VARCHAR(30)  NOT NULL,
  title       VARCHAR(100) NOT NULL,
  body        MEDIUMTEXT   NULL,                 -- 마크다운
  sort_order  INT          NOT NULL DEFAULT 0,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_content_sections_page (page_slug, sort_order, id),
  CONSTRAINT fk_content_sections_page FOREIGN KEY (page_slug) REFERENCES content_pages (slug)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO content_sections (page_slug, title, body, sort_order)
SELECT slug, '개요', body, 0 FROM content_pages WHERE body IS NOT NULL AND TRIM(body) <> '';
