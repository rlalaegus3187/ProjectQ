<script setup>
// 켜고 끄는 스위치 (사용 / 판매 / 보이기 등 온오프 값) — 체크박스에 role="switch"
//   <ToggleSwitch v-model="item.isActive" label="사용" />            ← 표 안 등 글자 없이 (label 은 화면 읽기용)
//   <label class="toggle"><ToggleSwitch v-model="x" /> 판매</label>   ← 옆에 글자와 함께 (글자를 눌러도 켜고 꺼짐)
defineProps({ label: { type: String, default: undefined } });
const on = defineModel({ type: Boolean, default: false });
</script>

<template>
  <span class="switch">
    <input v-model="on" type="checkbox" role="switch" :aria-checked="on" :aria-label="label" />
    <span class="slider" />
  </span>
</template>
