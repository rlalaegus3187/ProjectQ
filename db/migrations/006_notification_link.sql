-- 006_notification_link.sql : 알림을 눌렀을 때 이동할 주소를 직접 지정 (게시글이 아닌 알림용, 예: /mypage)
-- link 가 없으면 기존처럼 post_id 로 게시글 주소를 만듦
ALTER TABLE notifications
  ADD COLUMN link VARCHAR(255) NULL AFTER post_id;
