<script setup>
// 프로필 입력칸 (프로필 이름 + 프로필 양식 항목) — 회원가입의 첫 프로필, 마이페이지 프로필 추가/수정에서 사용
//   <ProfileFields v-model:name="form.name" v-model:details="form.details" :definitions="defs" />
import AttributeInput from './AttributeInput.vue';

defineProps({
  definitions: { type: Object, required: true },
  legend: { type: String, default: '프로필' },
  namePlaceholder: { type: String, default: '예: 기본 프로필, 과거 모습' },
  nameRequired: { type: Boolean, default: true },
});
const name = defineModel('name', { type: String, default: '' });
const details = defineModel('details', { type: Object, required: true });
</script>

<template>
  <fieldset class="fieldset">
    <legend>{{ legend }}</legend>
    <label class="field">
      <span>프로필 이름<span v-if="nameRequired" class="req">*</span></span>
      <input v-model="name" maxlength="50" :required="nameRequired" :placeholder="namePlaceholder" />
    </label>
    <p v-if="!definitions.details.length" class="muted">등록된 프로필 양식이 없습니다.</p>
    <AttributeInput v-for="def in definitions.details" :key="def.code" v-model="details[def.code]" :def="def" />
  </fieldset>
</template>
