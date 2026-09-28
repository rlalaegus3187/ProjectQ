<script setup>
// 캐릭터 입력 폼 (기본정보 / 캐릭터 스탯 / 프로필). 회원가입·마이페이지에서 함께 사용
// 캐릭터 스탯/프로필 입력칸은 관리자 페이지에서 정의한 항목(definitions)대로 자동 생성
import AttributeInput from './AttributeInput.vue';

defineProps({
  definitions: { type: Object, required: true },
});
const form = defineModel({ type: Object, required: true });
</script>

<template>
  <fieldset class="fieldset">
    <legend>기본정보</legend>
    <label>캐릭터 이름 <input v-model="form.name" required maxlength="50" /></label>
    <label>HP <input v-model="form.hp" type="number" min="0" step="1" required /></label>
  </fieldset>

  <fieldset class="fieldset">
    <legend>캐릭터 스탯</legend>
    <p v-if="!definitions.stats.length" class="muted">등록된 캐릭터 스탯 항목이 없습니다.</p>
    <AttributeInput v-for="def in definitions.stats" :key="def.code" v-model="form.stats[def.code]" :def="def" />
  </fieldset>

  <fieldset class="fieldset">
    <legend>프로필</legend>
    <p v-if="!definitions.details.length" class="muted">등록된 프로필 양식이 없습니다.</p>
    <AttributeInput v-for="def in definitions.details" :key="def.code" v-model="form.details[def.code]" :def="def" />
  </fieldset>
</template>
