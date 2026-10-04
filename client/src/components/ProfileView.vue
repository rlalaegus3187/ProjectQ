<script setup>
// 프로필 하나 보기 (보기 전용): 프로필 음악 링크 + 프로필 양식 값
import AttributeValue from './AttributeValue.vue';
import { youtubeUrl } from '../music';

defineProps({
  profile: { type: Object, required: true },
});
</script>

<template>
  <div class="profile-view">
    <p v-if="profile.musicVideoId" class="profile-music">
      ♪ 프로필 음악 <a :href="youtubeUrl(profile.musicVideoId)" target="_blank" rel="noopener noreferrer">유튜브에서 보기</a>
    </p>
    <p v-if="!profile.details.length" class="muted">등록된 프로필 양식이 없습니다.</p>
    <dl v-else class="kv">
      <template v-for="detail in profile.details" :key="detail.code">
        <dt>{{ detail.label }}</dt><dd><AttributeValue :attr="detail" /></dd>
      </template>
    </dl>
  </div>
</template>
