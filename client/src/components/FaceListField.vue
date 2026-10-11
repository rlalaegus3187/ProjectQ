<script setup>
// 프로필 입력의 '채팅용 두상' 목록 — 두상 칸 바로 옆(아래)에 표시, 여러 개 등록
//   <FaceListField v-model="form.faces" />   항목: { id?(이미 저장된 것), code?, name, image }
// 저장은 프로필 저장과 함께 (server/src/faces.js saveFaces). 채팅에서는 대표 프로필의 두상을 골라 말함
import { ref } from 'vue';
import ImageField from './ImageField.vue';

const faces = defineModel({ type: Array, required: true });
const MAX = 30;
const open = ref(null);   // 펼쳐서 고치는 항목 번호

let key = 0;
const add = () => {
  const next = [...faces.value, { key: `new-${(key += 1)}`, name: faces.value.length ? '' : '기본', image: '' }];
  faces.value = next;
  open.value = next.length - 1;   // 새 항목은 펼쳐서 (부모가 값을 바꿔 줄 때까지 faces.value 는 예전 값일 수 있음)
};
function remove(i) {
  const f = faces.value[i];
  if (f.id && !confirm(`'${f.name}' 두상을 지울까요? (프로필을 저장하면 지워짐)\n이 두상으로 말한 채팅은 남고, 두상만 기본 모양으로 바뀝니다.`)) return;
  faces.value = faces.value.filter((_, j) => j !== i);
  open.value = null;
}
</script>

<template>
  <div class="field wide face-field">
    <span>채팅용 두상 <span class="muted">({{ faces.length }}/{{ MAX }} · 채팅에서 표정처럼 골라 말함 — 대표 프로필의 두상이 쓰임, 정사각형 권장)</span></span>
    <ul class="face-grid">
      <li v-for="(f, i) in faces" :key="f.id || f.key" :class="{ open: open === i }">
        <button type="button" class="face-thumb" :title="open === i ? '접기' : '고치기'" @click="open = open === i ? null : i">
          <img v-if="f.image" :src="f.image" :alt="f.name" referrerpolicy="no-referrer" loading="lazy" />
          <span v-else class="muted">이미지</span>
        </button>
        <input v-model="f.name" maxlength="30" required placeholder="이름 (예: 웃음)" :aria-label="`두상 ${i + 1} 이름`" />
        <code v-if="f.code" class="muted">{{ f.code }}</code>
        <div v-if="open === i" class="face-edit">
          <ImageField v-model="f.image" :alt="f.name || '두상'" />
        </div>
        <span class="face-actions">
          <button type="button" class="link" @click="open = open === i ? null : i">{{ open === i ? '접기' : '이미지' }}</button>
          <button type="button" class="link danger-text" @click="remove(i)">삭제</button>
        </span>
      </li>
      <li v-if="faces.length < MAX" class="face-add">
        <button type="button" class="secondary" @click="add">+ 두상 추가</button>
      </li>
    </ul>
  </div>
</template>
