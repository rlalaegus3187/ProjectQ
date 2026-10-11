-- 030_image_links.sql : 이미지 칸에 업로드 파일 말고 링크(http(s)://...)도 넣을 수 있게 — 긴 링크가 들어가도록 칸을 넓힘
-- (프로필 이미지 항목 character_details.value 는 이미 TEXT, 파비콘은 settings.value)
ALTER TABLE items MODIFY COLUMN image VARCHAR(1000) NULL;
ALTER TABLE home_banners MODIFY COLUMN image VARCHAR(1000) NOT NULL;
