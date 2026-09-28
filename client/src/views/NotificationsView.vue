<script setup>
// 내 알림 (Q&A 답변 등)
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { api } from '../api';
import { formatDate } from '../boards';
import { notifications as badge } from '../notifications';

const router = useRouter();
const list = ref(null);
const error = ref('');

async function load() {
  const data = await api('/notifications');
  list.value = data.notifications;
  badge.unread = data.unreadCount;
}

async function open(n) {
  if (!n.isRead) {
    await api(`/notifications/${n.id}/read`, { method: 'POST' }).catch(() => {});
    badge.unread = Math.max(0, badge.unread - 1);
    n.isRead = true;
  }
  if (n.link) router.push(n.link);
}

async function readAll() {
  await api('/notifications/read-all', { method: 'POST' });
  await load();
}

onMounted(() => load().catch((e) => { error.value = e.message; }));
</script>

<template>
  <section class="card">
    <div class="card-head">
      <h1>알림</h1>
      <button v-if="list?.some((n) => !n.isRead)" type="button" class="secondary" @click="readAll">모두 읽음</button>
    </div>
    <p v-if="error" class="error">{{ error }}</p>
    <p v-else-if="!list" class="muted">불러오는 중…</p>
    <p v-else-if="!list.length" class="muted">알림이 없습니다.</p>
    <ul v-else class="post-list">
      <li v-for="n in list" :key="n.id">
        <button type="button" class="post-link notification" :class="{ unread: !n.isRead }" @click="open(n)">
          <span class="post-title"><span v-if="!n.isRead" class="dot" aria-label="안 읽음" />{{ n.message }}</span>
          <span class="post-meta">{{ formatDate(n.createdAt) }}</span>
        </button>
      </li>
    </ul>
  </section>
</template>
