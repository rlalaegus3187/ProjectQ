import { createRouter, createWebHistory } from 'vue-router';
import { loadUser } from './auth';
import { BOARDS } from './boards';
import { refreshUnread } from './notifications';
import HomeView from './views/HomeView.vue';
import LoginView from './views/LoginView.vue';
import SignupView from './views/SignupView.vue';
import MyPageView from './views/MyPageView.vue';
import AdminView from './views/AdminView.vue';
import BoardListView from './views/BoardListView.vue';
import PostDetailView from './views/PostDetailView.vue';
import PostEditView from './views/PostEditView.vue';
import NotificationsView from './views/NotificationsView.vue';
import InventoryView from './views/InventoryView.vue';

// 게시판 (/qna)
const BOARD = `:board(${Object.keys(BOARDS).join('|')})`;

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: HomeView },
    { path: '/login', component: LoginView, meta: { guestOnly: true } },
    { path: '/signup', component: SignupView, meta: { guestOnly: true } },
    { path: '/mypage', component: MyPageView, meta: { requiresAuth: true } },
    { path: '/notifications', component: NotificationsView, meta: { requiresAuth: true } },
    { path: '/inventory', component: InventoryView, meta: { requiresAuth: true } },
    { path: '/admin', component: AdminView, meta: { requiresAuth: true, requiresAdmin: true } },
    { path: '/admin/applicants', component: () => import('./views/AdminApplicantsView.vue'), meta: { requiresAuth: true, requiresAdmin: true } },
    { path: '/admin/items', component: () => import('./views/AdminItemsView.vue'), meta: { requiresAuth: true, requiresAdmin: true } },
    { path: '/admin/shop', component: () => import('./views/AdminShopView.vue'), meta: { requiresAuth: true, requiresAdmin: true } },
    { path: '/admin/settings', component: () => import('./views/AdminSettingsView.vue'), meta: { requiresAuth: true, requiresAdmin: true } },
    { path: '/shop', component: () => import('./views/ShopView.vue') },
    // 멤버란 (전체 캐릭터) — 로그인 없이 공개. 회원만 보게 하려면 meta: { requiresAuth: true } 추가
    { path: '/members', component: () => import('./views/MemberListView.vue') },
    { path: '/members/:id(\\d+)', component: () => import('./views/MemberDetailView.vue') },
    // 콘텐츠 페이지 (pages/ 폴더) — 들어갈 때만 불러옴
    { path: '/notice', component: () => import('./pages/notice/NoticePage.vue') },
    { path: '/world', component: () => import('./pages/world/WorldPage.vue') },
    { path: '/system', component: () => import('./pages/system/SystemPage.vue') },
    { path: '/guide', component: () => import('./pages/guide/GuidePage.vue') },
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
  // 관리자 전용 게시판의 글쓰기는 관리자만
  if (to.meta.write && BOARDS[to.params.board]?.adminOnly && user.role !== 'admin') return `/${to.params.board}`;
  if (to.meta.guestOnly && user) return '/mypage';
});

// 페이지 이동 때 알림 개수 갱신
router.afterEach(() => { refreshUnread(); });

export default router;
