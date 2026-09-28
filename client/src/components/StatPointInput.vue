<script setup>
// 투자 포인트 스탯 입력: [-] 값 [+]  (남은 포인트가 없으면 + 불가)
import { computed } from 'vue';

const props = defineProps({
  def: { type: Object, required: true },
  remaining: { type: Number, required: true },   // 전체 남은 포인트
});
const value = defineModel({ type: [String, Number], default: '' });

const current = computed(() => {
  const n = Number(value.value);
  return Number.isFinite(n) && value.value !== '' ? n : 0;
});
// 이 칸에 넣을 수 있는 최댓값 = 현재 값 + 남은 포인트 → 초과하면 칸이 invalid 가 되어 브라우저가 제출을 막음
const max = computed(() => Math.max(current.value + props.remaining, 0));
const inputId = `attr-stat-${props.def.code}`;

function step(delta) {
  value.value = Math.min(Math.max(current.value + delta, 0), max.value);
}
</script>

<template>
  <div class="field">
    <label :for="inputId">{{ def.label }}<span v-if="def.isRequired" class="req">*</span></label>
    <div class="stepper">
      <button type="button" class="secondary" :disabled="current <= 0" aria-label="1 빼기" @click="step(-1)">−</button>
      <input :id="inputId" v-model="value" type="number" min="0" step="1" :max="max" :required="def.isRequired" />
      <button type="button" class="secondary" :disabled="remaining <= 0" aria-label="1 더하기" @click="step(1)">+</button>
    </div>
  </div>
</template>
