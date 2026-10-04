-- 018_content_visibility.sql : 콘텐츠 페이지(공지·세계관·시스템·캐릭터 가이드) 공개 / 비공개
--   is_public = 0 이면 관리자만 볼 수 있음 (멤버도 못 봄, 메뉴에서도 숨김) — 관리 → 페이지 관리에서 페이지마다 설정
ALTER TABLE content_pages
  ADD COLUMN is_public TINYINT(1) NOT NULL DEFAULT 1 AFTER music_video_id;
