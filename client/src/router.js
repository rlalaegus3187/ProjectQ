import { createRouter, createWebHistory } from 'vue-router';
import { loadUser } from './auth';
import { site, loadSite } from './site';
import { BOARDS } from './boards';
import { refreshUnread } from './notifications';
import { cssFilesFor, loadCss, dropCssExcept } from './pageCss';
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
// CSS (client/public/css/basic/): style.css 공통(항상), admin.css 관리 화면, pages/<페이지>.css 그 페이지만
//   meta: { css: '페이지이름' } → pages/페이지이름.css 를 그 화면에서만 불러옴 (client/src/pageCss.js)

// 게시판 (/qna)
const BOARD = `:board(${Object.keys(BOARDS).join('|')})`;
// 콘텐츠 페이지 (공지·세계관 등 + 관리자가 추가한 페이지) — 내용은 DB, 관리 → 페이지 관리에서 작성
// 주소 /<slug> (영문 소문자·숫자·-). 다른 화면 주소가 먼저 매칭되고, 없는 페이지면 화면에서 '찾을 수 없음'
const CONTENT = ':slug([a-z][a-z0-9-]*)';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: HomePage, meta: { css: 'HomePage' } },
    { path: '/login', component: LoginPage, meta: { guestOnly: true } },
    { path: '/signup', component: SignupPage, meta: { guestOnly: true, css: 'SignupPage' } },
    { path: '/mypage', component: MyPage, meta: { requiresAuth: true, css: 'MyPage' } },
    { path: '/notifications', component: NotificationsPage, meta: { requiresAuth: true, css: 'NotificationsPage' } },
    { path: '/inventory', component: InventoryPage, meta: { requiresAuth: true, css: 'InventoryPage' } },
    // 관리 — AdminLayout(관리 메뉴) 안에 각 관리 페이지가 들어감. 권한 검사는 여기 한 번만 (자식에게 적용)
    {
      path: '/admin',
      component: () => import('./layouts/AdminLayout.vue'),
      // wide: 넓은 화면 (왼쪽 메뉴), layoutCss: 관리 화면 전체에 /css/basic/admin.css
      meta: { requiresAuth: true, requiresAdmin: true, wide: true, layoutCss: 'admin' },
      children: [
        { path: '', redirect: '/admin/applicants' },
        { path: 'applicants', component: () => import('./pages/admin/ApplicantsPage.vue') },
        { path: 'users', component: () => import('./pages/admin/UsersPage.vue') },
        { path: 'contents/:slug?', component: () => import('./pages/admin/ContentEditPage.vue') },
        { path: 'menu', component: () => import('./pages/admin/MenuPage.vue') },
        { path: 'attributes', component: () => import('./pages/admin/AttributesPage.vue') },
        // 아이템 관리 → 아이템 목록 / 캐릭터 아이템 관리 / 아이템 효과
        { path: 'items', redirect: '/admin/items/list' },
        { path: 'items/list', component: () => import('./pages/admin/ItemListPage.vue') },
        { path: 'items/characters', component: () => import('./pages/admin/CharacterItemsPage.vue') },
        { path: 'items/effects', component: () => import('./pages/admin/ItemEffectsPage.vue') },
        { path: 'shop', component: () => import('./pages/admin/ShopPage.vue') },
        // 칭호 관리 → 칭호 목록 / 칭호 부여
        { path: 'titles', redirect: '/admin/titles/list' },
        { path: 'titles/list', component: () => import('./pages/admin/TitleListPage.vue') },
        { path: 'titles/grant', component: () => import('./pages/admin/TitleGrantPage.vue') },
        { path: 'settings', component: () => import('./pages/admin/SettingsPage.vue') },
        { path: 'themes', component: () => import('./pages/admin/ThemesPage.vue') },
      ],
    },
    { path: '/shop', component: () => import('./pages/shop/ShopPage.vue'), meta: { css: 'ShopPage' } },
    // 멤버란 (전체 캐릭터) — 로그인 없이 공개. 회원만 보게 하려면 meta: { requiresAuth: true } 추가
    { path: '/members', component: () => import('./pages/members/MemberListPage.vue'), meta: { css: 'MemberListPage' } },
    { path: '/members/:id(\\d+)', component: () => import('./pages/members/MemberDetailPage.vue') },
    { path: `/${BOARD}`, component: BoardListPage, meta: { css: 'BoardListPage' } },
    // 글쓰기·수정: 비회원도 들어올 수 있음 (Q&A 비회원 글쓰기 허용 / 비밀번호로 수정) — 권한은 서버가 판단
    { path: `/${BOARD}/write`, component: PostEditPage, meta: { write: true, css: 'PostEditPage' } },
    { path: `/${BOARD}/:id(\\d+)`, component: PostDetailPage, meta: { css: 'PostDetailPage' } },
    { path: `/${BOARD}/:id(\\d+)/edit`, component: PostEditPage, meta: { css: 'PostEditPage' } },
    // 콘텐츠 페이지 — 파일 하나(ContentPage)가 주소의 slug 로 DB 내용을 불러와 표시
    // 게시판(/qna) 등 다른 주소보다 뒤에 둬야 함 (같은 모양의 주소는 먼저 등록된 쪽이 이김)
    { path: `/${CONTENT}`, component: () => import('./pages/content/ContentPage.vue'), meta: { wide: true, css: 'ContentPage' } },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
  // 다른 화면으로 가면 맨 위로. 같은 화면에서 ?profile= 등만 바뀌면 지금 위치 그대로,
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

// 화면별 css: 새 화면에 필요한 css 를 먼저 받아 두고(beforeResolve), 화면이 바뀐 뒤 필요 없는 css 를 뺌(afterEach)
// (가드는 값을 돌려주면 그 값으로 이동하므로 await 만 하고 아무것도 돌려주지 않음)
router.beforeResolve(async (to) => { await loadCss(cssFilesFor(to)); });

// 페이지 이동 때 알림 개수 갱신
router.afterEach((to, from, failure) => {
  if (!failure) dropCssExcept(cssFilesFor(to));
  refreshUnread();
});

export default router;
