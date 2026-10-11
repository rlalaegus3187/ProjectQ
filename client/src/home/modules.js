// 메인페이지 모듈 화면 — key 는 서버 server/src/home.js 의 MODULES 와 같아야 함
// 순서·표시는 관리 → 메인페이지 관리 → 메인페이지 설정, 데이터는 GET /api/home 의 data[key]
//   각 컴포넌트는 props 로 data(그 모듈 데이터, 없으면 null)를 받음
import BannerModule from './BannerModule.vue';
import WelcomeModule from './WelcomeModule.vue';
import CalendarModule from './CalendarModule.vue';
import MenuModule from './MenuModule.vue';

export const HOME_MODULES = {
  banner: BannerModule,
  welcome: WelcomeModule,
  calendar: CalendarModule,
  menu: MenuModule,
};
