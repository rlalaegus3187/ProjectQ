<script setup>
// 소지금 내역 목록
import { formatDate } from '../boards';
import { formatMoney, moneyReasonLabel } from '../items';

defineProps({
  logs: { type: Array, required: true },
});
</script>

<template>
  <p v-if="!logs.length" class="muted">소지금 내역이 없습니다.</p>
  <ul v-else class="money-logs">
    <li v-for="l in logs" :key="l.id">
      <span class="money-amount" :class="l.amount > 0 ? 'plus' : 'minus'">{{ l.amount > 0 ? '+' : '' }}{{ formatMoney(l.amount) }}</span>
      <span class="money-memo">{{ moneyReasonLabel(l.reason) }}<template v-if="l.memo"> · {{ l.memo }}</template></span>
      <span class="muted">잔액 {{ formatMoney(l.balance) }} · {{ formatDate(l.createdAt) }}</span>
    </li>
  </ul>
</template>
