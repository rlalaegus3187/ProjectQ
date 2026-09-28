<script setup>
// 캐릭터 정보 표시 (기본정보 / 캐릭터 스탯 / 프로필)
import AttributeValue from './AttributeValue.vue';

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
        <dt>HP</dt><dd>{{ character.hp }}</dd>
      </dl>
    </section>

    <section>
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

    <section>
      <h3>프로필</h3>
      <p v-if="!character.details.length" class="muted">등록된 프로필 양식이 없습니다.</p>
      <dl v-else class="kv">
        <template v-for="detail in character.details" :key="detail.code">
          <dt>{{ detail.label }}</dt><dd><AttributeValue :attr="detail" /></dd>
        </template>
      </dl>
    </section>
  </div>
</template>
