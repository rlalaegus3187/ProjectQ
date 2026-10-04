-- 020_notification_archive.sql : 알림 보관함
--   is_archived = 1 이면 보관함으로 (알림 목록에서 빠지고, 삭제할 수 없음 — '모두 삭제'에도 남음)
--   보관하면 읽음 처리. 보관 해제하면 다시 알림 목록으로
ALTER TABLE notifications
  ADD COLUMN is_archived TINYINT(1) NOT NULL DEFAULT 0 AFTER is_read,
  ADD COLUMN archived_at DATETIME NULL AFTER is_archived,
  ADD KEY idx_notifications_box (user_id, is_archived, id);
