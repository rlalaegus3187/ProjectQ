<script setup>
// 콘텐츠 페이지 공통 틀 (메뉴의 페이지들: 공지·세계관 ... + 관리자가 추가한 페이지)
//   위: 제목 · 알림 / 왼쪽: 소탭 목록 / 오른쪽: 소탭 내용을 순서대로
//   소탭 목록을 누르면 그 소탭이 시작하는 곳으로 스크롤, 스크롤하면 지금 보는 소탭이 목록에 표시됨
//   주소 끝 #s-<번호> 로 들어오면 그 소탭부터
//
//   <ContentLayout :title="..." :description="..." :sections="[{ id, title }, ...]">
//     <template #actions> 제목 오른쪽 버튼 </template>
//     <template #notice> 제목 아래 안내 </template>
//     <template #section="{ section }"> 그 소탭의 내용 </template>
//     <template #empty> 소탭이 없을 때 </template>
//   </ContentLayout>
//
// 내용(데이터)은 쓰는 쪽(pages/content/ContentPage.vue)이 채우고, 이 파일은 모양과 스크롤만 담당
import { ref, watch, nextTick, onMounted, onBeforeUnmount } from 'vue';
import { useRoute, useRouter } from 'vue-router';

const props = defineProps({
  title: { type: String, required: true },
  description: { type: String, default: '' },
  sections: { type: Array, default: () => [] },   // [{ id, title }]
});

const route = useRoute();
const router = useRouter();
const activeId = ref(null);   // 지금 화면에 보이는 소탭
let observer = null;

const anchor = (s) => `s-${s.id}`;

function scrollTo(section, { smooth = true } = {}) {
  const el = document.getElementById(anchor(section));
  if (!el) return;
  el.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'start' });
  activeId.value = section.id;
  router.replace({ hash: `#${anchor(section)}` });   // 공유용 주소 (기록은 남기지 않음)
}

// 스크롤하면서 지금 보고 있는 소탭을 왼쪽 목록에 표시
async function setup() {
  observer?.disconnect();
  activeId.value = props.sections[0]?.id ?? null;
  if (!props.sections.length) return;
  await nextTick();
  observer = new IntersectionObserver((entries) => {
    const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
    if (visible[0]) activeId.value = Number(visible[0].target.dataset.id);
  }, { rootMargin: '0px 0px -70% 0px' });
  for (const s of props.sections) {
    const el = document.getElementById(anchor(s));
    if (el) observer.observe(el);
  }
  const target = props.sections.find((s) => `#${anchor(s)}` === route.hash);
  if (target) scrollTo(target, { smooth: false });
}

watch(() => props.sections.map((s) => s.id).join(','), setup);
onMounted(setup);
onBeforeUnmount(() => observer?.disconnect());
</script>

<template>
  <section class="card content-page">
    <header class="page-header">
      <div class="card-head">
        <h1>{{ title }}</h1>
        <slot name="actions" />
      </div>
      <p v-if="description" class="muted">{{ description }}</p>
      <slot name="notice" />
    </header>

    <slot v-if="!sections.length" name="empty"><p class="muted">준비 중입니다.</p></slot>
    <div v-else class="content-layout" :class="{ single: sections.length < 2 }">
      <!-- 소탭 목록 (2개 이상일 때) -->
      <nav v-if="sections.length > 1" class="section-nav" aria-label="소탭 목록">
        <a v-for="s in sections" :key="s.id" :href="`#${anchor(s)}`" :class="{ active: s.id === activeId }"
          @click.prevent="scrollTo(s)">{{ s.title }}</a>
      </nav>
      <div class="section-body">
        <section v-for="s in sections" :id="anchor(s)" :key="s.id" :data-id="s.id" class="content-section">
          <h2>{{ s.title }}</h2>
          <slot name="section" :section="s" />
        </section>
      </div>
    </div>
  </section>
</template>
