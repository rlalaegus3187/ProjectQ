-- 003_attribute_types.sql : 항목 형식 확장 (캐릭터 스탯 / 프로필 양식 공통)
--   number    숫자
--   text      짧은 텍스트
--   long_text 긴 텍스트
--   link      링크 (http/https URL)
--   image     이미지 (업로드한 파일 경로)
--   select    드롭다운 (options 중 하나 선택)
ALTER TABLE attribute_definitions
  MODIFY value_type ENUM('number', 'text', 'long_text', 'link', 'image', 'select') NOT NULL DEFAULT 'text',
  ADD COLUMN options JSON NULL COMMENT '드롭다운 선택지 (문자열 배열)' AFTER value_type;

-- 스탯도 숫자 외 형식을 쓸 수 있도록 값 저장을 텍스트로 (기존 숫자 값은 그대로 문자열로 보존)
ALTER TABLE character_stats
  MODIFY value TEXT NOT NULL;
