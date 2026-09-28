import { createRouter, createWebHistory } from 'vue-router';
import { loadUser } from './auth';
import { BOARDS } from './boards';
import { refreshUnread } from './notifications';
import HomeView from './views/HomeView.vue';
import LoginView from './views/LoginView.vue';
import SignupView from './views/SignupView.vue';
import MyPageView from './views/MyPageView.vue';
import AdminView from './views/AdminView.vue';
import AdminPostsView from './views/AdminPostsView.vue';
import BoardListView from './views/BoardListView.vue';
import PostDetailView from './views/PostDetailView.vue';
import PostEditView from './views/PostEditView.vue';
import NotificationsView from './views/NotificationsView.vue';

// /notice, /world, /guide, /qna 게시판
const BOARD = `:board(${Object.keys(BOARDS).join('|')})`;

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: HomeView },
    { path: '/login', component: LoginView, meta: { guestOnly: true } },
    { path: '/signup', component: SignupView, meta: { guestOnly: true } },
    { path: '/mypage', component: MyPageView, meta: { requiresAuth: true } },
    { path: '/notifications', component: NotificationsView, meta: { requiresAuth: true } },
    { path: '/admin', component: AdminView, meta: { requiresAuth: true, requiresAdmin: true } },
    { path: '/admin/posts', component: AdminPostsView, meta: { requiresAuth: true, requiresAdmin: true } },
    { path: `/${BOARD}`, component: BoardListView },
    { path: `/${BOARD}/write`, component: PostEditView, meta: { requiresAuth: true, write: true } },
    { path: `/${BOARD}/:id(\\d+)`, component: PostDetailView },
    { path: `/${BOARD}/:id(\\d+)/edit`, component: PostEditView, meta: { requiresAuth: true } },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
  scrollBehavior: () => ({ top: 0 }),
});

// 라우트 가드: 로그인/관리자 필요한 페이지 보호, 로그인 상태면 로그인/가입 페이지 건너뜀
router.beforeEach(async (to) => {
  const user = await loadUser();
  if (to.meta.requiresAuth && !user) {
    return { path: '/login', query: { redirect: to.fullPath } };
  }
  if (to.meta.requiresAdmin && user.role !== 'admin') return '/mypage';
  // 공지/세계관/캐릭터 가이드 글쓰기는 관리자만
  if (to.meta.write && BOARDS[to.params.board]?.adminOnly && user.role !== 'admin') return `/${to.params.board}`;
  if (to.meta.guestOnly && user) return '/mypage';
});

// 페이지 이동 때 알림 개수 갱신
router.afterEach(() => { refreshUnread(); });

export default router;
