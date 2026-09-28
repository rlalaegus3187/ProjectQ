-- 011_roles_applicants.sql : 권한 3단계 (관리자 / 멤버 / 신청자) + 신청 상태
--   admin     관리자
--   member    멤버 — 멤버란에 캐릭터가 보임 (기존 'user'(일반) 회원은 멤버로 바뀜)
--   applicant 신청자 — 가입하면 기본값. 프로필 1개만, 멤버란에 안 보임 (관리 → 신청자 관리에서 확인)
ALTER TABLE users
  MODIFY COLUMN role ENUM('admin', 'user', 'member', 'applicant') NOT NULL DEFAULT 'applicant';
UPDATE users SET role = 'member' WHERE role = 'user';
ALTER TABLE users
  MODIFY COLUMN role ENUM('admin', 'member', 'applicant') NOT NULL DEFAULT 'applicant';

-- 신청서(캐릭터) 상태: draft = 작성중, submitted = 작성완료 (신청자만 사용)
ALTER TABLE characters
  ADD COLUMN application_status ENUM('draft', 'submitted') NOT NULL DEFAULT 'draft' AFTER money,
  ADD COLUMN submitted_at DATETIME NULL AFTER application_status,
  ADD KEY idx_characters_application (application_status);
