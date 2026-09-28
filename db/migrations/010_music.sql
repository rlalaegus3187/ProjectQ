-- 010_music.sql : 프로필 음악(유튜브) + 계정별 음악 설정
-- 프로필마다 유튜브 영상 ID (없으면 재생 안 함). 링크는 서버에서 ID 로 바꿔 저장
ALTER TABLE character_profiles
  ADD COLUMN music_video_id VARCHAR(11) NULL AFTER name;

-- 계정별 음악 설정: 볼륨(0~100), 재생 여부(0 = 정지)
ALTER TABLE users
  ADD COLUMN music_volume  TINYINT UNSIGNED NOT NULL DEFAULT 50 AFTER role,
  ADD COLUMN music_enabled TINYINT(1)       NOT NULL DEFAULT 1  AFTER music_volume;

-- 사이트 전체 음악은 settings 테이블의 site_music (유튜브 영상 ID) — 관리자 페이지에서 설정
