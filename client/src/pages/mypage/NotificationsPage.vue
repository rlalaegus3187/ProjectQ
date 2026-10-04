<script setup>
// 내 알림 — 알림 / 보관함 (주소 ?box=archive 면 보관함)
//   알림마다 [보관] [삭제]. 보관한 알림은 보관함으로 가고 삭제되지 않음 ('모두 삭제'에도 남음) — 지우려면 보관 해제 후 삭제
import { ref, computed, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api } from '../../api';
import { formatDate } from '../../boards';
import { notifications as badge } from '../../notifications';

const route = useRoute();
const router = useRouter();
const list = ref(null);
const counts = ref({ inboxCount: 0, archivedCount: 0 });
const error = ref('');
const busy = ref(false);

const isArchive = computed(() => route.query.box === 'archive');

function applyCounts(data) {
  counts.value = { inboxCount: data.inboxCount, archivedCount: data.archivedCount };
  badge.unread = data.unreadCount;
}

async function load() {
  error.value = '';
  const data = await api(`/notifications${isArchive.value ? '?box=archive' : ''}`);
  list.value = data.notifications;
  applyCounts(data);
}

const setBox = (archive) => router.replace({ query: archive ? { box: 'archive' } : {} });

async function open(n) {
  if (!n.isRead) {
    await api(`/notifications/${n.id}/read`, { method: 'POST' }).catch(() => {});
    badge.unread = Math.max(0, badge.unread - 1);
    n.isRead = true;
  }
  if (n.link) router.push(n.link);
}

async function act(fn) {
  error.value = '';
  busy.value = true;
  try {
    await fn();
  } catch (e) {
    error.value = e.message;
  } finally {
    busy.value = false;
  }
}

// 보관 / 보관 해제 → 지금 목록에서 빠짐
const archive = (n, archived) => act(async () => {
  applyCounts(await api(`/notifications/${n.id}/archive`, { method: 'PUT', body: { archived } }));
  list.value = list.value.filter((x) => x.id !== n.id);
});

const remove = (n) => act(async () => {
  applyCounts(await api(`/notifications/${n.id}`, { method: 'DELETE' }));
  list.value = list.value.filter((x) => x.id !== n.id);
});

const readAll = () => act(async () => {
  await api('/notifications/read-all', { method: 'POST' });
  await load();
});

const removeAll = () => confirm(`알림 ${counts.value.inboxCount}개를 모두 삭제할까요?\n보관함에 있는 알림은 지워지지 않습니다.`)
  && act(async () => {
    applyCounts(await api('/notifications/delete-all', { method: 'POST' }));
    list.value = [];
  });

watch(isArchive, () => { list.value = null; load().catch((e) => { error.value = e.message; }); }, { immediate: true });
</script>

<template>
  <section class="card">
    <div class="card-head">
      <h1>알림</h1>
      <div v-if="!isArchive && list?.length" class="actions">
        <button v-if="list.some((n) => !n.isRead)" type="button" class="secondary" :disabled="busy" @click="readAll">모두 읽음</button>
        <button type="button" class="danger" :disabled="busy" @click="removeAll">모두 삭제</button>
      </div>
    </div>

    <div class="tabs profile-tabs" role="tablist">
      <button type="button" role="tab" :aria-selected="!isArchive" :class="{ active: !isArchive }" @click="setBox(false)">
        알림 <span class="muted">{{ counts.inboxCount }}</span>
      </button>
      <button type="button" role="tab" :aria-selected="isArchive" :class="{ active: isArchive }" @click="setBox(true)">
        보관함 <span class="muted">{{ counts.archivedCount }}</span>
      </button>
    </div>
    <p v-if="isArchive" class="muted">보관한 알림은 삭제되지 않습니다. 지우려면 보관을 해제한 뒤 알림에서 삭제하세요.</p>

    <p v-if="error" class="error">{{ error }}</p>
    <p v-if="!list" class="muted">불러오는 중…</p>
    <p v-else-if="!list.length" class="muted">{{ isArchive ? '보관한 알림이 없습니다.' : '알림이 없습니다.' }}</p>
    <ul v-else class="post-list notification-list">
      <li v-for="n in list" :key="n.id">
        <button type="button" class="post-link notification" :class="{ unread: !n.isRead }" @click="open(n)">
          <span class="post-title"><span v-if="!n.isRead" class="dot" aria-label="안 읽음" />{{ n.message }}</span>
          <span class="post-meta">{{ formatDate(n.createdAt) }}</span>
        </button>
        <div class="notification-actions">
          <template v-if="!isArchive">
            <button type="button" class="secondary small" :disabled="busy" title="보관함으로 (삭제되지 않음)" @click="archive(n, true)">보관</button>
            <button type="button" class="danger small" :disabled="busy" @click="remove(n)">삭제</button>
          </template>
          <button v-else type="button" class="secondary small" :disabled="busy" @click="archive(n, false)">보관 해제</button>
        </div>
      </li>
    </ul>
  </section>
</template>
