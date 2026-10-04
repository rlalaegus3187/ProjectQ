-- 특별 스탯 → '코스트' 로 이름 변경 + 현재치 / 최대치를 따로 기록
-- costN_current 현재치, costN_max 최대치 (N = 1~5, 이름·사용 여부는 settings.costs)
ALTER TABLE characters
  ADD COLUMN cost1_current INT NULL AFTER name,
  ADD COLUMN cost1_max     INT NULL AFTER cost1_current,
  ADD COLUMN cost2_current INT NULL AFTER cost1_max,
  ADD COLUMN cost2_max     INT NULL AFTER cost2_current,
  ADD COLUMN cost3_current INT NULL AFTER cost2_max,
  ADD COLUMN cost3_max     INT NULL AFTER cost3_current,
  ADD COLUMN cost4_current INT NULL AFTER cost3_max,
  ADD COLUMN cost4_max     INT NULL AFTER cost4_current,
  ADD COLUMN cost5_current INT NULL AFTER cost4_max,
  ADD COLUMN cost5_max     INT NULL AFTER cost5_current;

-- 기존 값은 현재치 = 최대치 로 옮김
UPDATE characters SET
  cost1_current = special1, cost1_max = special1,
  cost2_current = special2, cost2_max = special2,
  cost3_current = special3, cost3_max = special3,
  cost4_current = special4, cost4_max = special4,
  cost5_current = special5, cost5_max = special5;

ALTER TABLE characters
  DROP COLUMN special1, DROP COLUMN special2, DROP COLUMN special3, DROP COLUMN special4, DROP COLUMN special5;

UPDATE settings SET name = 'costs' WHERE name = 'special_stats';
