-- 004_stat_points.sql : 캐릭터 스탯 투자 포인트
-- 관리자가 정하는 전역 설정을 저장하는 키-값 테이블
CREATE TABLE IF NOT EXISTS settings (
  name        VARCHAR(100) NOT NULL,
  value       VARCHAR(1000) NOT NULL,
  updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 초기 투자 포인트: 캐릭터가 숫자형 스탯에 나눠 줄 수 있는 포인트 총량
-- 기본 20. 이미 입력된 스탯 합계가 20 을 넘는 캐릭터가 있으면 그 최댓값으로 시작 (기존 캐릭터가 저장 불가가 되지 않도록)
INSERT IGNORE INTO settings (name, value)
SELECT 'stat_initial_points', CAST(GREATEST(20, COALESCE(MAX(t.total), 0)) AS CHAR)
  FROM (
    SELECT CEIL(SUM(CAST(s.value AS DECIMAL(20, 2)))) AS total
      FROM character_stats s
      JOIN attribute_definitions d ON d.id = s.definition_id
     WHERE d.value_type = 'number' AND d.is_active = 1
     GROUP BY s.character_id
  ) t;
