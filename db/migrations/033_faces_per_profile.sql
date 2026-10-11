-- 033_faces_per_profile.sql : 채팅용 두상(표정)을 프로필에 묶음
--   character_faces.profile_id → character_profiles (프로필을 지우면 그 두상도 삭제, 그 두상으로 말한 채팅은 face_id NULL)
--   프로필 수정 팝업에서 두상 칸 옆에 목록으로 등록, 채팅에서는 대표 프로필의 두상을 골라 씀
--   code('<캐릭터 id>_<번호>')·seq 는 그대로 (캐릭터 안에서 이어지는 번호)
ALTER TABLE character_faces ADD COLUMN profile_id INT UNSIGNED NULL AFTER character_id;
UPDATE character_faces f JOIN character_profiles p ON p.character_id = f.character_id AND p.is_main = 1 SET f.profile_id = p.id;
DELETE FROM character_faces WHERE profile_id IS NULL;
ALTER TABLE character_faces
  MODIFY profile_id INT UNSIGNED NOT NULL,
  ADD KEY idx_character_faces_profile (profile_id, seq),
  ADD CONSTRAINT fk_character_faces_profile FOREIGN KEY (profile_id) REFERENCES character_profiles (id) ON DELETE CASCADE;
