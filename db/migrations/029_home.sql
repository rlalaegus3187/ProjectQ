-- 029_home.sql : 메인페이지 모듈 — 배너 · 캘린더 이벤트 (관리 → 메인페이지 관리)
--   home_banners  배너  image(업로드 경로) · title(제목/대체 글) · link(누르면 이동, 비우면 없음) · sort_order
--   home_events   캘린더 이벤트  title · description · color(#rrggbb) · start_date ~ end_date (하루짜리면 같은 날)
--   메인에 보일 모듈·순서는 settings.home_modules (JSON), 캘린더에 보일 달은 settings.home_calendar_months
CREATE TABLE IF NOT EXISTS home_banners (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  image       VARCHAR(255) NOT NULL,
  title       VARCHAR(100) NULL,
  link        VARCHAR(500) NULL,
  sort_order  INT          NOT NULL DEFAULT 0,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS home_events (
  id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  title        VARCHAR(100) NOT NULL,
  description  TEXT         NULL,
  color        CHAR(7)      NOT NULL DEFAULT '#2563eb',
  start_date   DATE         NOT NULL,
  end_date     DATE         NOT NULL,
  created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_home_events_range (start_date, end_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
