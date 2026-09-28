<script setup>
// 캐릭터 정보 표시 (기본정보 / 스탯 / 세부정보)
defineProps({
  character: { type: Object, required: true },
});

const show = (value) => (value === null || value === '' ? '-' : value);
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
      <h3>스탯</h3>
      <p v-if="!character.stats.length" class="muted">등록된 스탯 항목이 없습니다.</p>
      <dl v-else class="kv">
        <template v-for="stat in character.stats" :key="stat.code">
          <dt>{{ stat.label }}</dt><dd>{{ show(stat.value) }}</dd>
        </template>
      </dl>
    </section>

    <section>
      <h3>세부정보</h3>
      <p v-if="!character.details.length" class="muted">등록된 세부정보 항목이 없습니다.</p>
      <dl v-else class="kv">
        <template v-for="detail in character.details" :key="detail.code">
          <dt>{{ detail.label }}</dt><dd>{{ show(detail.value) }}</dd>
        </template>
      </dl>
    </section>
  </div>
</template>
