<script setup>
// 켜고 끄는 스위치 (사용 / 판매 / 보이기 등 온오프 값) — 체크박스가 아닌 <button role="switch">
//   <ToggleSwitch v-model="item.isActive" label="사용" />            ← 표 안 등 글자 없이 (label 은 화면 읽기용)
//   <label class="toggle"><ToggleSwitch v-model="x" /> 판매</label>   ← 옆에 글자와 함께 (글자를 눌러도 켜고 꺼짐)
// 바뀌면 v-model 갱신 후 change 이벤트 (바로 저장할 때 @change)
defineProps({
  label: { type: String, default: undefined },
  disabled: { type: Boolean, default: false },
});
const on = defineModel({ type: Boolean, default: false });
const emit = defineEmits(['change']);

function toggle() {
  on.value = !on.value;
  emit('change', on.value);
}
</script>

<template>
  <button type="button" class="switch" role="switch" :aria-checked="on ? 'true' : 'false'" :aria-label="label" :disabled="disabled"
    @click="toggle" />
</template>
