import { reactive } from 'vue';
import { api } from './api';
import { auth } from './auth';

// 메뉴에 표시할 안 읽은 알림 개수
export const notifications = reactive({ unread: 0 });

let lastFetch = 0;

// 페이지 이동 때마다 호출 (너무 자주 요청하지 않도록 15초 간격)
export async function refreshUnread({ force = false } = {}) {
  if (!auth.user) {
    notifications.unread = 0;
    return;
  }
  if (!force && Date.now() - lastFetch < 15000) return;
  lastFetch = Date.now();
  try {
    notifications.unread = (await api('/notifications/unread-count')).unreadCount;
  } catch {
    // 알림 개수는 부가 정보라 실패해도 무시
  }
}
