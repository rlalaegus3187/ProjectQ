import { createRouter, createWebHistory } from 'vue-router';
import { loadUser } from './auth';
import { BOARDS } from './boards';
import { refreshUnread } from './notifications';
import HomePage from './pages/home/HomePage.vue';
import LoginPage from './pages/auth/LoginPage.vue';
import SignupPage from './pages/auth/SignupPage.vue';
import MyPage from './pages/mypage/MyPage.vue';
import InventoryPage from './pages/mypage/InventoryPage.vue';
import NotificationsPage from './pages/mypage/NotificationsPage.vue';
import BoardListPage from './pages/board/BoardListPage.vue';
import PostDetailPage from './pages/board/PostDetailPage.vue';
import PostEditPage from './pages/board/PostEditPage.vue';
import { CONTENT_SLUGS } from './contents';

// 폴더 구조 (자세한 건 pages/README.md)
//   pages/<기능>/*Page.vue   주소 1개 = 파일 1개
//   layouts/*Layout.vue      여러 페이지가 같이 쓰는 바깥 틀 (자식 라우트가 안에 들어감)
//   components/              여러 페이지에서 쓰는 부품

// 게시판 (/qna)
const BOARD = `:board(${Object.keys(BOARDS).join('|')})`;
// 콘텐츠 페이지 (공지·세계관·시스템·캐릭터 가이드) — 내용은 DB, 관리 → 페이지 관리에서 작성
const CONTENT = `:slug(${CONTENT_SLUGS.join('|')})`;

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: HomePage },
    { path: '/login', component: LoginPage, meta: { guestOnly: true } },
    { path: '/signup', component: SignupPage, meta: { guestOnly: true } },
    { path: '/mypage', component: MyPage, meta: { requiresAuth: true } },
    { path: '/notifications', component: NotificationsPage, meta: { requiresAuth: true } },
    { path: '/inventory', component: InventoryPage, meta: { requiresAuth: true } },
    // 관리 — AdminLayout(관리 메뉴) 안에 각 관리 페이지가 들어감. 권한 검사는 여기 한 번만 (자식에게 적용)
    {
      path: '/admin',
      component: () => import('./layouts/AdminLayout.vue'),
      meta: { requiresAuth: true, requiresAdmin: true },
      children: [
        { path: '', redirect: '/admin/applicants' },
        { path: 'applicants', component: () => import('./pages/admin/ApplicantsPage.vue') },
        { path: 'contents/:slug?', component: () => import('./pages/admin/ContentEditPage.vue') },
        { path: 'attributes', component: () => import('./pages/admin/AttributesPage.vue') },
        { path: 'items', component: () => import('./pages/admin/ItemsPage.vue') },
        { path: 'shop', component: () => import('./pages/admin/ShopPage.vue') },
        { path: 'settings', component: () => import('./pages/admin/SettingsPage.vue') },
      ],
    },
    { path: '/shop', component: () => import('./pages/shop/ShopPage.vue') },
    // 멤버란 (전체 캐릭터) — 로그인 없이 공개. 회원만 보게 하려면 meta: { requiresAuth: true } 추가
    { path: '/members', component: () => import('./pages/members/MemberListPage.vue') },
    { path: '/members/:id(\\d+)', component: () => import('./pages/members/MemberDetailPage.vue') },
    // 콘텐츠 페이지 — 파일 하나(ContentPage)가 주소의 slug 로 DB 내용을 불러와 표시
    { path: `/${CONTENT}`, component: () => import('./pages/content/ContentPage.vue') },
    { path: `/${BOARD}`, component: BoardListPage },
    { path: `/${BOARD}/write`, component: PostEditPage, meta: { requiresAuth: true, write: true } },
    { path: `/${BOARD}/:id(\\d+)`, component: PostDetailPage },
    { path: `/${BOARD}/:id(\\d+)/edit`, component: PostEditPage, meta: { requiresAuth: true } },
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
