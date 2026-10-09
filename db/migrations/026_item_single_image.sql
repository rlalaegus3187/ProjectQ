-- 026_item_single_image.sql : 아이템 이미지를 하나로 (작은/큰 이미지 구분 없음)
--   image ← 큰 이미지가 있으면 큰 이미지, 없으면 작은 이미지
ALTER TABLE items ADD COLUMN image VARCHAR(255) NULL AFTER description;   -- 업로드 경로 (/api/uploads/...)
UPDATE items SET image = COALESCE(large_image, small_image), updated_at = updated_at;
ALTER TABLE items DROP COLUMN small_image, DROP COLUMN large_image;
