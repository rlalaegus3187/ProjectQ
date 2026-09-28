<script setup>
// 항목 하나의 입력칸 — 형식(valueType)에 따라 입력 방식이 달라짐
import { MarkdownEditor } from '../markdown';
import ImageField from './ImageField.vue';

const props = defineProps({
  def: { type: Object, required: true },
});
const value = defineModel({ type: [String, Number], default: '' });

const inputId = `attr-${props.def.category}-${props.def.code}`;
</script>

<template>
  <div class="field" :class="{ wide: ['long_text', 'image'].includes(def.valueType) }">
    <label :for="inputId">{{ def.label }}<span v-if="def.isRequired" class="req">*</span></label>

    <input v-if="def.valueType === 'number'" :id="inputId" v-model="value" type="number" step="any" :required="def.isRequired" />

    <!-- 긴 텍스트: 마크다운 편집기 (툴바 · 이미지 넣기 · 미리보기) -->
    <MarkdownEditor v-else-if="def.valueType === 'long_text'" :id="inputId" v-model="value" :rows="6" :maxlength="10000"
      placeholder="내용을 입력하세요. (마크다운 사용 가능)" />

    <input v-else-if="def.valueType === 'link'" :id="inputId" v-model="value" type="url" placeholder="https://" maxlength="2000" :required="def.isRequired" />

    <select v-else-if="def.valueType === 'select'" :id="inputId" v-model="value" :required="def.isRequired">
      <option value="">선택하세요</option>
      <option v-for="opt in def.options || []" :key="opt" :value="opt">{{ opt }}</option>
    </select>

    <ImageField v-else-if="def.valueType === 'image'" :id="inputId" v-model="value" :alt="def.label" />

    <input v-else :id="inputId" v-model="value" maxlength="500" :required="def.isRequired" />
  </div>
</template>
