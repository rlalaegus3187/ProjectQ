<script setup>
// 캐릭터 정보 표시 (기본정보 / 캐릭터 스탯 — 스탯 미사용이면 기본정보만) — 프로필은 ProfileSection
import AttributeValue from './AttributeValue.vue';
import { site } from '../site';

defineProps({
  character: { type: Object, required: true },
});
</script>

<template>
  <div class="char-sections">
    <section>
      <h3>기본정보</h3>
      <dl class="kv">
        <dt>캐릭터 이름</dt><dd>{{ character.name }}</dd>
        <template v-for="s in character.costs || []" :key="s.slot">
          <dt>{{ s.name }}</dt><dd>{{ s.current ?? '—' }} / {{ s.max ?? '—' }}</dd>
        </template>
      </dl>
    </section>

    <!-- 관리 → 캐릭터 항목에서 캐릭터 스탯을 '미사용'으로 두면 숨김 -->
    <section v-if="site.statsEnabled">
      <h3>캐릭터 스탯</h3>
      <div v-if="character.statPoints" class="points-bar" :class="{ over: character.statPoints.used > character.statPoints.total }">
        투자 포인트 <strong>{{ character.statPoints.used }}</strong> / {{ character.statPoints.total }}
        <span>· 남은 포인트 <strong>{{ character.statPoints.total - character.statPoints.used }}</strong></span>
      </div>
      <p v-if="!character.stats.length" class="muted">등록된 캐릭터 스탯 항목이 없습니다.</p>
      <dl v-else class="kv">
        <template v-for="stat in character.stats" :key="stat.code">
          <dt>{{ stat.label }}</dt><dd><AttributeValue :attr="stat" /></dd>
        </template>
      </dl>
    </section>

  </div>
</template>
