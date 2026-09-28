<script setup>
// 캐릭터 입력 폼 (기본정보 / 스탯 / 세부정보). 회원가입·마이페이지에서 함께 사용
// 스탯/세부정보 입력칸은 관리자 페이지에서 정의한 항목(definitions)대로 자동 생성
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
    <legend>스탯</legend>
    <p v-if="!definitions.stats.length" class="muted">등록된 스탯 항목이 없습니다.</p>
    <label v-for="def in definitions.stats" :key="def.code">
      <span>{{ def.label }}<span v-if="def.isRequired" class="req">*</span></span>
      <input v-model="form.stats[def.code]" type="number" step="1" :required="def.isRequired" />
    </label>
  </fieldset>

  <fieldset class="fieldset">
    <legend>세부정보</legend>
    <p v-if="!definitions.details.length" class="muted">등록된 세부정보 항목이 없습니다.</p>
    <label v-for="def in definitions.details" :key="def.code">
      <span>{{ def.label }}<span v-if="def.isRequired" class="req">*</span></span>
      <input
        v-model="form.details[def.code]"
        :type="def.valueType === 'number' ? 'number' : 'text'"
        :step="def.valueType === 'number' ? 'any' : undefined"
        :required="def.isRequired"
        maxlength="1000"
      />
    </label>
  </fieldset>
</template>
