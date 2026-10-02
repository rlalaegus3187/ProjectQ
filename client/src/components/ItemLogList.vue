<script setup>
// 아이템 습득/사용 기록 — 언제, 어디서(획득처), 몇 개, 그 뒤 보유 수량
//   <ItemLogList :logs="logs" />              (여러 아이템: 아이템 이름 표시)
//   <ItemLogList :logs="logs" hide-item />    (아이템 하나의 기록)
import { itemSourceLabel } from '../items';

defineProps({
  logs: { type: Array, required: true },
  hideItem: { type: Boolean, default: false },
  showActor: { type: Boolean, default: false },   // 처리한 사람 (관리자 화면)
});

const formatTime = (v) => new Date(v).toLocaleString('ko-KR', {
  year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
});
</script>

<template>
  <p v-if="!logs.length" class="muted">기록이 없습니다.</p>
  <ul v-else class="money-logs item-logs">
    <li v-for="l in logs" :key="l.id">
      <span class="money-amount" :class="l.amount > 0 ? 'plus' : 'minus'">{{ l.amount > 0 ? '+' : '' }}{{ l.amount }}</span>
      <span class="money-memo">
        <template v-if="!hideItem"><strong>{{ l.item.name }}</strong> · </template>
        {{ itemSourceLabel(l.source) }}<template v-if="l.memo"> · {{ l.memo }}</template>
        <span v-if="showActor && l.actorName" class="muted"> ({{ l.actorName }})</span>
      </span>
      <span class="muted">보유 {{ l.quantityAfter }} · {{ formatTime(l.createdAt) }}</span>
    </li>
  </ul>
</template>
