-- 특별 스탯 1~5 (HP, MP, 이성 등 — 이름과 사용 여부는 관리 → 캐릭터 항목에서 지정, settings.special_stats)
-- 포인트를 나눠 주는 캐릭터 스탯과 달리 각자 따로 정하는 숫자 값. 기존 hp 는 특별 스탯 1(HP)로 옮김
ALTER TABLE characters
  ADD COLUMN special1 INT NULL AFTER name,
  ADD COLUMN special2 INT NULL AFTER special1,
  ADD COLUMN special3 INT NULL AFTER special2,
  ADD COLUMN special4 INT NULL AFTER special3,
  ADD COLUMN special5 INT NULL AFTER special4;

UPDATE characters SET special1 = hp;

ALTER TABLE characters DROP COLUMN hp;
