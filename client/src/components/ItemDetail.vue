<script setup>
// 아이템 상세 (큰 이미지, 설명, 효과, 귀속/판매 여부)
import { MarkdownView } from '../markdown';
import { effectLabel, formatEffectValues, itemSourceLabel, loadItemEffects } from '../items';

defineProps({
  item: { type: Object, required: true },
  quantity: { type: Number, default: null },
  entry: { type: Object, default: null },   // 인벤토리 항목이면 습득 정보 표시 { acquiredAt, lastAcquiredAt, lastSource, lastMemo }
});
const formatTime = (v) => new Date(v).toLocaleString('ko-KR');
loadItemEffects().catch(() => {});   // 효과 이름 표시용
</script>

<template>
  <div class="item-detail">
    <img v-if="item.image" :src="item.image" :alt="item.name" class="item-large" />
    <div class="item-badges">
      <span v-if="quantity !== null" class="badge">보유 {{ quantity }}개</span>
      <span class="badge" :class="item.isBound ? 'lock' : 'answered'">{{ item.isBound ? '귀속' : '양도 가능' }}</span>
      <span class="badge" :class="item.isSellable ? 'answered' : 'lock'">{{ item.isSellable ? '판매 가능' : '판매 불가' }}</span>
    </div>
    <dl class="kv">
      <dt>효과</dt>
      <dd>{{ effectLabel(item.effect) }}<template v-if="formatEffectValues(item.effectValues)"> · {{ formatEffectValues(item.effectValues) }}</template></dd>
      <template v-if="entry">
        <dt>최근 습득</dt>
        <dd>{{ formatTime(entry.lastAcquiredAt) }}<template v-if="entry.lastSource"> · {{ itemSourceLabel(entry.lastSource) }}</template><template v-if="entry.lastMemo"> ({{ entry.lastMemo }})</template></dd>
        <dt>처음 습득</dt>
        <dd>{{ formatTime(entry.acquiredAt) }}</dd>
      </template>
    </dl>
    <MarkdownView v-if="item.description" :source="item.description" />
  </div>
</template>
