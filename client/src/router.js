import { createRouter, createWebHistory } from 'vue-router';
import { loadUser } from './auth';
import { site, loadSite } from './site';
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

// 폴더 구조 (자세한 건 pages/README.md)
//   pages/<기능>/*Page.vue   주소 1개 = 파일 1개
//   layouts/*Layout.vue      여러 페이지가 같이 쓰는 바깥 틀 (자식 라우트가 안에 들어감)
//   components/              여러 페이지에서 쓰는 부품

// 게시판 (/qna)
const BOARD = `:board(${Object.keys(BOARDS).join('|')})`;
// 콘텐츠 페이지 (공지·세계관 등 + 관리자가 추가한 페이지) — 내용은 DB, 관리 → 페이지 관리에서 작성
// 주소 /<slug> (영문 소문자·숫자·-). 다른 화면 주소가 먼저 매칭되고, 없는 페이지면 화면에서 '찾을 수 없음'
const CONTENT = ':slug([a-z][a-z0-9-]*)';

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
      meta: { requiresAuth: true, requiresAdmin: true, wide: true },   // wide: 넓은 화면 (왼쪽 메뉴)
      children: [
        { path: '', redirect: '/admin/applicants' },
        { path: 'applicants', component: () => import('./pages/admin/ApplicantsPage.vue') },
        { path: 'users', component: () => import('./pages/admin/UsersPage.vue') },
        { path: 'contents/:slug?', component: () => import('./pages/admin/ContentEditPage.vue') },
        { path: 'menu', component: () => import('./pages/admin/MenuPage.vue') },
        { path: 'attributes', component: () => import('./pages/admin/AttributesPage.vue') },
        { path: 'items', component: () => import('./pages/admin/ItemsPage.vue') },
        { path: 'shop', component: () => import('./pages/admin/ShopPage.vue') },
        { path: 'settings', component: () => import('./pages/admin/SettingsPage.vue') },
        { path: 'themes', component: () => import('./pages/admin/ThemesPage.vue') },
      ],
    },
    { path: '/shop', component: () => import('./pages/shop/ShopPage.vue') },
    // 멤버란 (전체 캐릭터) — 로그인 없이 공개. 회원만 보게 하려면 meta: { requiresAuth: true } 추가
    { path: '/members', component: () => import('./pages/members/MemberListPage.vue') },
    { path: '/members/:id(\\d+)', component: () => import('./pages/members/MemberDetailPage.vue') },
    { path: `/${BOARD}`, component: BoardListPage },
    // 글쓰기·수정: 비회원도 들어올 수 있음 (Q&A 비회원 글쓰기 허용 / 비밀번호로 수정) — 권한은 서버가 판단
    { path: `/${BOARD}/write`, component: PostEditPage, meta: { write: true } },
    { path: `/${BOARD}/:id(\\d+)`, component: PostDetailPage },
    { path: `/${BOARD}/:id(\\d+)/edit`, component: PostEditPage },
    // 콘텐츠 페이지 — 파일 하나(ContentPage)가 주소의 slug 로 DB 내용을 불러와 표시
    // 게시판(/qna) 등 다른 주소보다 뒤에 둬야 함 (같은 모양의 주소는 먼저 등록된 쪽이 이김)
    { path: `/${CONTENT}`, component: () => import('./pages/content/ContentPage.vue'), meta: { wide: true } },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
  // 다른 화면으로 가면 맨 위로. 같은 화면에서 #소탭 / ?profile= 만 바뀌면 지금 위치 그대로 (소탭 스크롤은 화면이 직접),
  // 뒤로 가기면 예전 위치로
  scrollBehavior: (to, from, savedPosition) => {
    if (savedPosition) return savedPosition;
    if (to.path === from.path) return false;
    return { top: 0 };
  },
});

// 라우트 가드: 로그인/관리자 필요한 페이지 보호, 로그인 상태면 로그인/가입 페이지 건너뜀
router.beforeEach(async (to) => {
  const [user] = await Promise.all([loadUser(), loadSite()]);
  // 회원 전용 모드(관리 → 사이트 설정): 로그인하지 않으면 로그인/회원가입 화면만
  if (site.private && !user && !to.meta.guestOnly) {
    return { path: '/login', query: to.fullPath !== '/' ? { redirect: to.fullPath } : {} };
  }
  if (to.meta.requiresAuth && !user) {
    return { path: '/login', query: { redirect: to.fullPath } };
  }
  if (to.meta.requiresAdmin && user.role !== 'admin') return '/mypage';
  // 관리자 전용 게시판의 글쓰기는 관리자만
  if (to.meta.write && BOARDS[to.params.board]?.adminOnly && user?.role !== 'admin') return `/${to.params.board}`;
  if (to.meta.guestOnly && user) return '/mypage';
});

// 페이지 이동 때 알림 개수 갱신
router.afterEach(() => { refreshUnread(); });

export default router;
