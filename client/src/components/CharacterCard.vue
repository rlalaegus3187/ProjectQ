<script setup>
// 캐릭터 정보 표시 (기본정보 · 칭호 / 캐릭터 스탯 — 스탯 미사용이면 기본정보만) — 프로필은 ProfileSection
//   hide-titles: 칭호 줄 숨김 (마이페이지는 칭호 칸이 따로 있음)
import { computed } from 'vue';
import AttributeValue from './AttributeValue.vue';
import TitleBadge from './TitleBadge.vue';
import { site } from '../site';

const props = defineProps({
  character: { type: Object, required: true },
  hideTitles: { type: Boolean, default: false },
});
// 대표 칭호를 맨 앞에
const titles = computed(() => {
  const list = props.character.titles || [];
  const mainId = props.character.mainTitle?.id;
  return [...list].sort((a, b) => (b.id === mainId) - (a.id === mainId));
});
</script>

<template>
  <div class="char-sections">
    <section>
      <h3>기본정보</h3>
      <dl class="kv">
        <dt>캐릭터 이름</dt><dd>{{ character.name }}</dd>
        <template v-if="!hideTitles && titles.length">
          <dt>칭호</dt>
          <dd class="title-list"><TitleBadge v-for="t in titles" :key="t.id" :title="t" /></dd>
        </template>
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
