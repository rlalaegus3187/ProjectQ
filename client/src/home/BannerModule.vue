<script setup>
// 배너 — 이미지를 누르면 지정한 주소로 이동 (사이트 안 주소는 같은 창, http(s) 주소는 새 탭)
// 여러 장이면 5초마다 넘어가고(마우스를 올리면 멈춤), 양옆 버튼·아래 점으로 넘겨 봄
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';

const props = defineProps({ data: { type: Object, default: null } });
const banners = computed(() => props.data?.banners || []);
const index = ref(0);
const paused = ref(false);
let timer = null;

const isInternal = (link) => link.startsWith('/');
function go(step) {
  const n = banners.value.length;
  if (n) index.value = (index.value + step + n) % n;
}
onMounted(() => { timer = setInterval(() => { if (!paused.value) go(1); }, 5000); });
onBeforeUnmount(() => clearInterval(timer));
</script>

<template>
  <section v-if="banners.length" class="home-banner" aria-label="배너" @mouseenter="paused = true" @mouseleave="paused = false">
    <div class="home-banner-track" :style="{ transform: `translateX(-${index * 100}%)` }">
      <div v-for="b in banners" :key="b.id" class="home-banner-slide">
        <RouterLink v-if="b.link && isInternal(b.link)" :to="b.link"><img referrerpolicy="no-referrer" :src="b.image" :alt="b.title || '배너'" /></RouterLink>
        <a v-else-if="b.link" :href="b.link" target="_blank" rel="noopener noreferrer"><img referrerpolicy="no-referrer" :src="b.image" :alt="b.title || '배너'" /></a>
        <img referrerpolicy="no-referrer" v-else :src="b.image" :alt="b.title || '배너'" />
      </div>
    </div>
    <template v-if="banners.length > 1">
      <button type="button" class="home-banner-nav prev" aria-label="이전 배너" @click="go(-1)">‹</button>
      <button type="button" class="home-banner-nav next" aria-label="다음 배너" @click="go(1)">›</button>
      <div class="home-banner-dots">
        <button v-for="(b, i) in banners" :key="b.id" type="button" :class="{ active: i === index }" :aria-label="`${i + 1}번째 배너`" @click="index = i" />
      </div>
    </template>
  </section>
</template>
