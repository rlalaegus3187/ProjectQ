<script setup>
// 캐릭터 입력 폼 (기본정보 / 캐릭터 스탯 [/ 대표 프로필 값])
//   withProfile: 새 캐릭터(회원가입·캐릭터 만들기)일 때 대표 프로필 값도 함께 입력. 수정 때는 false (프로필은 따로 수정)
// 캐릭터 스탯/프로필 입력칸은 관리자 페이지에서 정의한 항목(definitions)대로 자동 생성
// 숫자형 캐릭터 스탯은 투자 포인트(definitions.statPoints)를 나눠 주는 방식
import { computed } from 'vue';
import { isPointStat } from '../character';
import AttributeInput from './AttributeInput.vue';
import StatPointInput from './StatPointInput.vue';
import ProfileFields from './ProfileFields.vue';

const props = defineProps({
  definitions: { type: Object, required: true },
  withProfile: { type: Boolean, default: true },
});
const form = defineModel({ type: Object, required: true });

const pointStats = computed(() => props.definitions.stats.filter(isPointStat));
const totalPoints = computed(() => props.definitions.statPoints ?? 0);
const usedPoints = computed(() => pointStats.value.reduce((sum, def) => {
  const n = Number(form.value.stats[def.code]);
  return sum + (Number.isFinite(n) ? n : 0);
}, 0));
const remaining = computed(() => totalPoints.value - usedPoints.value);
</script>

<template>
  <fieldset class="fieldset">
    <legend>기본정보</legend>
    <label>캐릭터 이름 <input v-model="form.name" required maxlength="50" /></label>
    <!-- 코스트 (HP, MP 등 — 현재치 / 최대치, 이름·사용 여부는 관리 → 캐릭터 항목) -->
    <div v-for="s in definitions.costs || []" :key="s.slot" class="field">
      <span>{{ s.name }} <span class="muted">(현재치 / 최대치)</span></span>
      <span class="cost-inputs">
        <input v-model="form.costs[s.slot].current" type="number" min="0" :max="form.costs[s.slot].max || undefined" step="1" required
          placeholder="현재치" :aria-label="`${s.name} 현재치`" />
        <span class="muted">/</span>
        <input v-model="form.costs[s.slot].max" type="number" min="0" step="1" required placeholder="최대치" :aria-label="`${s.name} 최대치`" />
      </span>
    </div>
  </fieldset>

  <!-- 관리 → 캐릭터 항목에서 캐릭터 스탯을 '미사용'으로 두면 숨김 -->
  <fieldset v-if="definitions.statsEnabled !== false" class="fieldset">
    <legend>캐릭터 스탯</legend>
    <p v-if="!definitions.stats.length" class="muted">등록된 캐릭터 스탯 항목이 없습니다.</p>
    <div v-if="pointStats.length" class="points-bar" :class="{ over: remaining < 0 }">
      투자 포인트 <strong>{{ usedPoints }}</strong> / {{ totalPoints }}
      <span>· 남은 포인트 <strong>{{ remaining }}</strong></span>
      <span v-if="remaining < 0"> — 전체 포인트를 넘었습니다. 줄여주세요.</span>
    </div>
    <template v-for="def in definitions.stats" :key="def.code">
      <StatPointInput v-if="isPointStat(def)" v-model="form.stats[def.code]" :def="def" :remaining="remaining" />
      <AttributeInput v-else v-model="form.stats[def.code]" :def="def" />
    </template>
  </fieldset>

  <ProfileFields v-if="withProfile" v-model:details="form.details" v-model:music="form.music" :definitions="definitions" legend="프로필" :show-name="false" />
</template>
