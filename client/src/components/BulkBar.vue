<script setup>
// 일괄 처리 막대: 선택 개수 + 버튼들(슬롯). 선택한 게 없으면 버튼이 비활성
//   <BulkBar :count="sel.ids.value.length" @clear="sel.clear()">
//     <button :disabled="!sel.ids.value.length" @click="...">사용 켜기</button>
//   </BulkBar>
defineProps({
  count: { type: Number, required: true },
});
const emit = defineEmits(['clear']);
</script>

<template>
  <div class="bulk-bar" :class="{ empty: !count }">
    <span class="count">
      <template v-if="count"><strong>{{ count }}</strong>개 선택 <button type="button" class="link small-link" @click="emit('clear')">선택 해제</button></template>
      <template v-else>체크박스로 여러 개를 골라 한꺼번에 바꿀 수 있습니다.</template>
    </span>
    <slot />
  </div>
</template>
