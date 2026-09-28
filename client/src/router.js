import { createRouter, createWebHistory } from 'vue-router';
import { loadUser } from './auth';
import HomeView from './views/HomeView.vue';
import LoginView from './views/LoginView.vue';
import SignupView from './views/SignupView.vue';
import MyPageView from './views/MyPageView.vue';
import AdminView from './views/AdminView.vue';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: HomeView },
    { path: '/login', component: LoginView, meta: { guestOnly: true } },
    { path: '/signup', component: SignupView, meta: { guestOnly: true } },
    { path: '/mypage', component: MyPageView, meta: { requiresAuth: true } },
    { path: '/admin', component: AdminView, meta: { requiresAuth: true, requiresAdmin: true } },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
});

// 라우트 가드: 로그인/관리자 필요한 페이지 보호, 로그인 상태면 로그인/가입 페이지 건너뜀
router.beforeEach(async (to) => {
  const user = await loadUser();
  if (to.meta.requiresAuth && !user) {
    return { path: '/login', query: { redirect: to.fullPath } };
  }
  if (to.meta.requiresAdmin && user.role !== 'admin') return '/mypage';
  if (to.meta.guestOnly && user) return '/mypage';
});

export default router;
