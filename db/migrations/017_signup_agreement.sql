-- 017_signup_agreement.sql : 회원가입 안내(약관) 동의 기록
--   agreed_at      동의한 시각 (NULL = 동의 기록 없음 — 이 기능 전에 가입한 회원)
--   agreed_notice  동의한 그때의 안내 내용 (관리자가 나중에 안내를 고쳐도 본인이 동의한 내용을 다시 볼 수 있게)
ALTER TABLE users
  ADD COLUMN agreed_at     DATETIME   NULL AFTER contact,
  ADD COLUMN agreed_notice MEDIUMTEXT NULL AFTER agreed_at;
