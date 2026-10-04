# ProjectQ

Vue 3 + Node.js/Express + MySQL 로 만든 SPA 로그인 샘플입니다.

- 세션 기반 로그인 (HttpOnly 쿠키, 세션은 MySQL 에 저장 → 재시작해도 로그인 유지)
- **아이디 + 비밀번호 로그인** (이메일·이름 없음). 회원가입은 아이디 / 비밀번호 / 소통 계정 + 가입 안내(주의문구) 동의 — 안내는 관리 → 사이트 설정에서 작성
  - 마이페이지 **약관동의 (완료)** 를 누르면 지금 가입 안내를 팝업으로 봄 (관리자가 고치면 고친 내용, 동의한 시각 표시). 기록이 없는 기존 회원은 (미완료) → 팝업에서 동의
  - 마이페이지 **계정 삭제**: 비밀번호 확인 + '복구할 수 없음' 동의 후 영구 삭제 (캐릭터·인벤토리·기록·Q&A 글·알림 함께 삭제, 마지막 관리자는 삭제 불가)
  - 아이디는 바꿀 수 없음, 비밀번호·소통 계정은 마이페이지에서 변경. 관리 → 회원 관리에서 비밀번호 강제 변경
  - 캐릭터는 가입한 뒤 마이페이지에서 작성
- **콘텐츠 페이지**: 공지 · 세계관 · 시스템 · 캐릭터 가이드 + **관리자가 추가한 페이지** — 내용은 DB, **관리 → 페이지 관리**에서 페이지 추가·삭제, 페이지마다 **소탭** 여러 개(마크다운), 공개/비공개·음악. 화면은 왼쪽 소탭 목록 + 순서대로 내용(누르면 그 소탭으로 스크롤) — `layouts/ContentLayout.vue`
- **메뉴 관리**: 관리 → 메뉴 관리에서 상단 메뉴(홈 바로가기)에 보일 탭과 순서 (콘텐츠 페이지 + 멤버·상점·Q&A)
- **CSS 테마**: `client/public/css/basic/` 이 기본 테마(항상 적용, 색·글꼴은 CSS 변수). `css/<테마>/style.css` 폴더를 추가하면 **관리 → 테마** 목록에 나타나고, 미리보기 후 적용 (basic 위에 덮어씀, DB `settings.site_theme`) — `client/public/css/README.md`
- **마크다운 편집기**: 제목·굵게·기울임·취소선·목록·인용·링크·이미지 (`client/src/markdown/README.md`)
- **Q&A 게시판**: 회원 질문·비밀글, 관리자 답변·메인 글 (마크다운 등록툴 + 이미지)
  - **비회원 질문**: 관리 → 사이트 설정의 스위치로 켜고 끔. 비회원은 이름 + 비밀번호로 작성(공개/비밀글), 비밀번호로 비밀글 보기·수정·삭제
  - **글 비밀번호**: 회원 비밀글에도 선택으로 걸 수 있음 → 비밀번호를 아는 사람은 로그인 없이 볼 수 있음
- **알림**: 내 Q&A 질문에 답변이 달리면 상단 `알림` 에 표시. **알림 / 보관함** 탭 — 알림마다 [보관] [삭제], '모두 삭제'. 보관한 알림은 삭제되지 않음 (보관 해제 후 삭제)
- **음악**: 프로필별 유튜브 음악, 사이트 전체 음악(관리 → 사이트 설정), 페이지별 음악(`usePageMusic`) — 오른쪽 아래 플레이어, 볼륨/정지는 계정별 저장 (`client/src/music/README.md`)
- **소지금 / 상점**: 캐릭터 소지금(내역 기록), 관리자가 소지금 지급·회수, `상점 관리`에서 등록된 아이템을 골라 가격·재고 설정, 회원은 `상점`에서 구매
- **아이템 / 인벤토리**: 관리자가 아이템 등록(이미지·효과·귀속·판매가능) 후 캐릭터에게 지급/회수, 회원은 `인벤토리` 에서 확인·버리기
  - **습득 기록**: 모든 습득·사용이 `item_logs` 에 언제·어디서(관리자 지급/상점 구매/버림 ...)·메모·처리한 사람과 함께 남음. 관리자 지급 때 획득처(예: 이벤트 보상) 입력
- **계정당 캐릭터 1개** — 가입할 때 함께 등록, 마이페이지에서 기본정보·캐릭터 스탯 표시·수정
- **멤버란** (`/members`): 멤버·관리자의 캐릭터만. 신청자의 캐릭터(신청서)는 목록에 없고, 주소(`/members/:id`)로 들어와도 **관리자만** 볼 수 있음 (다른 사람에겐 '찾을 수 없음'). 전체 캐릭터 목록(대표 프로필 이미지·검색) + 캐릭터 상세(기본정보·스탯·프로필, 보기 전용, 로그인 없이 공개)
- **캐릭터 프로필 여러 개** (최대 10): 마이페이지엔 내 프로필 **목록**(대표 표시, 보기·수정·대표로·삭제), 수정·추가는 **팝업 폼**. 캐릭터 페이지(`/members/:id`)는 대표 프로필이 먼저 보이고 위쪽 목록에서 다른 프로필 선택(`?profile=<번호>` 로 바로 열기), 프로필마다 음악이 바뀜. 본인은 그 자리에서 '이 프로필 수정'
  - 입력 폼은 모두 같은 모양(팝업 + 칸 묶음 + 한 줄에 한 칸): 프로필, 캐릭터 수정, 아이템 등록·수정
  - 프로필 양식 값만 프로필마다 따로 (기본정보·스탯·인벤토리는 캐릭터에 하나)
- **권한 3단계: 관리자 / 멤버 / 신청자** — 가입하면 신청자(프로필 1개, 멤버란에 안 보임). 신청자는 마이페이지에서 신청서를 `작성중 ↔ 작성완료` 로 바꾸고(작성완료면 수정 잠금),
  관리자는 `관리 → 신청자 관리`에서 신청 프로필을 보고 **체크해서 한꺼번에 멤버로 전환**(신청 프로필이 대표 프로필, 멤버란 공개, 알림) 또는 **한꺼번에 삭제**
- **관리 페이지**: 왼쪽 메뉴(그룹별)에서 고르면 오른쪽에 내용 (SPA, 좁은 화면에선 위쪽 가로 메뉴). 목록 화면(캐릭터 스탯·프로필 양식, 아이템, 상점)은 **체크박스로 전체/일부 선택 → 일괄 처리** (선택 저장, 사용·필수·귀속·판매 켜기/끄기, 선택 삭제 — 한 번에 하나라도 틀리면 전부 취소)
- 관리자는 `관리 → 캐릭터 항목 관리`(`/admin/attributes`) 에서 캐릭터 스탯·프로필 양식 항목을 추가/수정/삭제
- 항목 형식: 숫자, 짧은 텍스트, 긴 텍스트(마크다운 편집기), 링크, 이미지(업로드), 드롭다운
- **스탯 투자 포인트**: 관리자가 초기 투자 포인트를 정하고, 캐릭터는 숫자형 스탯에 포인트를 나눠 투자 (합계 ≤ 전체 포인트)
- **프로필 추가 / 수정 허용**: 관리 → 사이트 설정의 스위치 두 개. 막으면 회원은 새 프로필 추가(또는 수정·삭제·대표 변경)를 못 함 — 서버도 거부, 관리자는 항상 가능
- **콘텐츠 페이지 공개 / 비공개**: 관리 → 페이지 관리에서 페이지마다. 비공개면 관리자만 볼 수 있음 (메뉴에는 메뉴 관리 설정대로 보이고, 들어가면 '비공개 페이지입니다' / 관리자 메뉴엔 🔒)
- **회원가입 허용 / 막음**: 관리 → 사이트 설정의 스위치. 막으면 가입 화면에 안내만 보이고 가입 링크가 사라지며 서버도 가입을 거부 (기존 회원 로그인은 그대로)
- **사이트 오픈 / 클로즈 (회원 전용)**: 관리 → 사이트 설정의 스위치. 켜면 로그인하지 않은 방문자는 메뉴 없는 입장(로그인) 화면만 보고, 서버 API 도 로그인·회원가입 등 일부만 허용
- **사이트 공개 / 비공개**: 관리 → 사이트 설정의 '사이트 공개' 스위치. 끄면 관리자 말고는 아무도 로그인할 수 없고(이미 로그인한 회원 포함) 어느 주소로 들어와도 설정한 문구(마크다운, 기본 "홈페이지 비공개 상태입니다.")만 보임. 서버 API 도 403 `{ siteClosed }` 로 막음. 관리자는 그 화면의 '관리자 로그인'으로 입장
- **신청서 제출**: 신청자는 마이페이지에서 자유롭게 저장하고, [신청서 제출] 때 '신청서 제출 동의사항'(관리 → 사이트 설정에서 작성)에 동의해야 제출됨. 제출 후 수정해서 저장하거나 [제출 취소]하면 작성중으로 돌아가 다시 제출해야 함
- **특별 스탯 1~5**: HP·MP·이성처럼 캐릭터마다 숫자를 그대로 입력하는 값 (`characters.special1~5`). 관리 → 캐릭터 항목에서 칸마다 이름과 사용 여부를 지정 (기본 1=HP, 2=MP). 끄면 숨겨지고 저장된 값은 남음
- **캐릭터 스탯 사용 / 미사용**: 관리 → 캐릭터 항목의 스위치. 미사용이면 마이페이지·캐릭터 화면·입력 폼에서 스탯이 보이지 않고 서버도 스탯 값을 받지 않음 (저장된 값은 남음)
- **사이트 이름 · 파비콘**: 관리 → 사이트 설정에서 이름(상단 로고·탭 제목)과 파비콘(ico/png 업로드, 브라우저 탭 아이콘)을 설정
- EC2(m6id Instance Store) 배포 스크립트와 **`deploy.js` 한 번으로 전체 업데이트**

## 폴더 구조

```
ProjectQ/
├─ client/                 Vue 3 + Vite + vue-router
│  ├─ public/css/          ★ CSS 테마 (basic = 기본, 폴더 추가 = 새 테마) — 배포하면 /css/ 로 올라감
│  └─ src/
│     ├─ api.js            fetch 래퍼 (/api 호출)
│     ├─ auth.js           로그인 상태(user) 관리
│     ├─ router.js         라우트 + 로그인/관리자 가드
│     ├─ character.js      캐릭터 폼 헬퍼
│     ├─ menu.js           상단 메뉴 목록
│     ├─ markdown/         ★ 마크다운 모듈 (renderMarkdown, MarkdownEditor, MarkdownView) — markdown/README.md
│     ├─ music/            ★ 음악 모듈 (MusicPlayer, usePageMusic, setSiteMusic, 볼륨/정지) — music/README.md
│     ├─ upload.js         이미지 업로드
│     ├─ menu.js           상단 메뉴 (관리 → 메뉴 관리, GET /api/menu)
│     ├─ site.js           사이트 이름·파비콘 (상단 로고, 브라우저 탭)
│     ├─ layouts/          여러 페이지 공통 바깥 틀 (AdminLayout = 관리 메뉴)
│     ├─ pages/            주소 1개 = *Page.vue 1개, 기능별 폴더 (home, auth, mypage, members, shop, board, content, admin) — pages/README.md
│     └─ components/       여러 페이지에서 쓰는 부품 (CharacterForm/Card, ProfileFormModal, ModalDialog, PostEditor ...)
├─ server/                 Express API
│  ├─ src/
│  │  ├─ index.js          앱 진입점 (세션, 라우트)
│  │  ├─ middleware/sitePrivate.js  회원 전용 모드: 로그인 안 한 API 요청 차단 (허용 목록 제외)
│  │  ├─ characters.js     캐릭터/항목 정의 검증·저장 로직
│  │  ├─ notify.js         ★ 알림 보내기 공용 함수 (notify / notifyUsers / notifyAdmins)
│  │  ├─ inventory.js      ★ 아이템/인벤토리 공용 함수 (giveItem / takeItem / getInventory)
│  │  ├─ routes/adminItems.js  /api/admin/items, /api/admin/characters (관리자)
│  │  ├─ routes/inventory.js   /api/inventory (내 인벤토리)
│  │  ├─ routes/members.js     /api/members (멤버란, 공개)
│  │  ├─ money.js          ★ 소지금 공용 함수 (getMoney / changeMoney / getMoneyLogs)
│  │  ├─ routes/shop.js        /api/shop (상점 목록·구매)
│  │  ├─ routes/adminShop.js   /api/admin/shop (상점 관리)
│  │  ├─ routes/adminApplicants.js  /api/admin/applicants (신청자 관리)
│  │  ├─ routes/contents.js    /api/contents, /api/menu, /api/admin/contents, /api/admin/menu (콘텐츠 페이지·소탭·메뉴)
│  │  ├─ menu.js           상단 메뉴 구성 (settings.site_menu)
│  │  ├─ routes/auth.js    /api/auth/signup, login, logout, me, me/password
│  │  ├─ routes/adminUsers.js  /api/admin/users (회원 관리, 비밀번호 강제 변경)
│  │  ├─ accounts.js       아이디·비밀번호·소통 계정 검증, 회원 세션 정리
│  │  ├─ routes/characters.js  /api/attributes, /api/characters
│  │  ├─ routes/admin.js   /api/admin/attributes (관리자)
│  │  ├─ routes/uploads.js /api/uploads (이미지 업로드/제공)
│  │  ├─ routes/boards.js  /api/boards (Q&A)
│  │  └─ routes/notifications.js  /api/notifications
│  ├─ scripts/migrate.js   DB 마이그레이션 (끝나면 필요한 테이블이 다 있는지 확인)
│  └─ scripts/seed.js      샘플 계정 생성
├─ db/                    MySQL 스키마 (구조 설명: db/README.md)
│  └─ migrations/          001_init.sql … 010_music.sql
├─ deploy/
│  ├─ mount-instance-store.sh  ① NVMe Instance Store → /data 마운트
│  ├─ setup-server.sh      ② EC2 기본 세팅 (Node, MySQL 데이터·임시파일·로그→/data, Nginx, PM2)
│  ├─ deploy.js            ③ git clone/pull → 설치 → 마이그레이션 → 빌드 → 재시작
│  ├─ setup-phpmyadmin.sh  (선택) phpMyAdmin → /phpmyadmin
│  └─ ecosystem.config.cjs PM2 설정
└─ docs/EC2_SETUP.md       배포 가이드
```

## API

| Method | Path | 설명 |
|---|---|---|
| GET | `/api/auth/signup-info` | 회원가입 허용 여부·안내(주의문구, 마크다운) `{ open, notice }` |
| POST | `/api/auth/signup` | `{ username, password, contact, agree: true }` 가입 후 자동 로그인 (신청자, 캐릭터는 마이페이지에서) |
| POST | `/api/auth/login` | `{ username, password }` |
| PUT | `/api/auth/me` | 소통 계정 수정 `{ contact }` (아이디는 변경 불가) |
| GET/PUT | `/api/auth/me/agreement` | 동의 시각 + 지금 안내 `{ agreedAt, notice }` / 기록이 없으면 지금 안내에 동의 `{ agree: true }` |
| DELETE | `/api/auth/me` | 계정 삭제 `{ password, confirm: true }` (되돌릴 수 없음, 마지막 관리자는 불가) |
| PUT | `/api/auth/me/password` | 비밀번호 변경 `{ currentPassword, newPassword }` → 다른 기기 로그아웃 |
| GET | `/api/admin/users?q=&role=&page=` | (관리자) 회원 목록 |
| PATCH | `/api/admin/users/role` | (관리자) 권한 일괄 변경 `{ ids, role }` → 알림 (내 계정 제외, 관리자 1명 이상 유지) |
| POST | `/api/admin/users/bulk-delete` | (관리자) 회원 일괄 삭제 `{ ids }` — 캐릭터·프로필 등 함께 삭제 (FK CASCADE) |
| PUT | `/api/admin/users/:id/password` | (관리자) 비밀번호 강제 변경 `{ newPassword }` → 그 회원 로그아웃 + 알림 |
| POST | `/api/auth/logout` | 세션 삭제 |
| GET | `/api/notifications?box=inbox\|archive` | 알림 / 보관함 목록 + `{ unreadCount, inboxCount, archivedCount }` |
| PUT | `/api/notifications/:id/archive` | 보관 / 보관 해제 `{ archived }` (보관하면 읽음) |
| DELETE | `/api/notifications/:id` | 삭제 (보관한 알림은 409) — `POST /api/notifications/delete-all` 은 보관함 빼고 모두 삭제 |
| PUT | `/api/auth/me/preferences` | 계정 음악 설정 `{ musicVolume(0~100), musicEnabled }` |
| GET | `/api/settings` | 공개 설정 `{ siteName, siteFavicon, siteMusic, qnaGuestWrite, sitePrivate, siteClosed, siteClosedMessage }` (회원 전용 모드에서도 로그인 없이 조회 가능) (사이트 이름·파비콘, 사이트 전체 음악 영상 ID) |
| GET | `/api/auth/me` | 현재 로그인 사용자 `{ id, username, contact, role }` (401 이면 비로그인) |
| GET | `/api/attributes` | 현재 입력받는 항목 + 투자 포인트 `{ stats, details, statPoints, statsEnabled, specials: [{ slot, name }] }` |
| GET | `/api/characters/me` | 내 캐릭터 (없으면 `character: null`) |
| POST | `/api/characters` | 캐릭터 등록 `{ name, specials: { 슬롯: 값 }, stats, details }` → 대표 프로필(캐릭터 이름으로 표시) 함께 생성 (계정당 1개) |
| PUT | `/api/characters/me` | 기본정보 + 특별 스탯 + 스탯 수정 `{ name, specials, stats }` (특별 스탯은 사용 중인 슬롯만, 0 이상 정수) |
| POST | `/api/characters/me/profiles` | 프로필 추가 `{ name, music?(유튜브 링크), details }` |
| PUT/DELETE | `/api/characters/me/profiles/:id` | 프로필 수정 `{ name, details }` (대표는 name 없음) / 삭제 (대표는 삭제 불가) |
| PUT | `/api/characters/me/profiles/:id/main` | 대표 프로필 지정 |
| GET | `/api/characters/me/application-notice` | (신청자) 신청서 제출 동의사항 `{ notice }` |
| POST | `/api/characters/me/application/submit` | (신청자) 신청서 제출 `{ agree: true }` — 작성중일 때만(이미 제출이면 409), 관리자에게 알림 |
| POST | `/api/characters/me/application/cancel` | (신청자) 제출 취소 → 작성중, 관리자에게 알림. 제출한 뒤 캐릭터·프로필을 수정해 저장해도 같은 방식으로 작성중이 됨 |
| GET | `/api/menu` | 상단 메뉴 (보이게 한 항목만, 순서대로) `[{ key, label, to, isPublic? }]` |
| GET | `/api/contents/:slug` | 콘텐츠 페이지 `{ slug, title, musicVideoId, isPublic, sections: [{ id, title, body }] }` — 비공개는 관리자만(403) |
| GET/POST | `/api/admin/contents` | (관리자) 페이지 목록(+소탭) / 새 페이지 `{ slug, title, showInMenu }` |
| PUT/DELETE | `/api/admin/contents/:slug` | (관리자) 저장 `{ title(메뉴 이름), isPublic, music, sections: [{ id?, title, body }] }` / 삭제 |
| GET/PUT | `/api/admin/menu` | (관리자) 메뉴 구성 `{ menu: [{ key, visible }] }` (순서대로) |
| GET | `/api/admin/applicants?status=&q=` | (관리자) 신청자 캐릭터 목록 + 상태별 개수 |
| GET | `/api/admin/applicants/:id` | (관리자) 신청자 캐릭터·프로필 보기 |
| POST | `/api/admin/applicants/accept` | (관리자) `{ characterIds: [...] }` 한꺼번에 멤버로 전환 (신청 프로필 → 대표 프로필, 알림) |
| POST | `/api/admin/applicants/delete` | (관리자) `{ characterIds: [...] }` 한꺼번에 캐릭터+프로필 삭제 (계정은 남음, 신청자만 처리) |
| PUT/PATCH | `/api/admin/attributes/bulk` | (관리자) 일괄 저장 `{ items: [{ id, label, valueType, ... }] }` / 사용·필수 일괄 변경 `{ ids, isActive?, isRequired? }` |
| POST | `/api/admin/attributes/bulk-delete`, `/api/admin/items/bulk-delete`, `/api/admin/shop/bulk-delete` | (관리자) 일괄 삭제 `{ ids }` |
| PATCH | `/api/admin/items/bulk` | (관리자) `{ ids, isBound?, isSellable? }` |
| PUT/PATCH | `/api/admin/shop/bulk` | (관리자) 일괄 저장 `{ items: [{ id, price, stock, isActive, sortOrder }] }` / 판매 켜기·끄기 `{ ids, isActive }` |
| GET | `/api/admin/themes` | (관리자) CSS 테마 목록 `{ themes: [{ id, name, description, author, css, preview }], active }` — 적용은 settings 의 `siteTheme` |
| GET/PUT | `/api/admin/settings` | (관리자) `{ statPoints, siteName, siteFavicon(업로드한 이미지 경로 — ico/png 등, 빈 값=없음), qnaGuestWrite(Q&A 비회원 글쓰기), sitePrivate(회원 전용), signupOpen(회원가입 허용), siteClosed(사이트 비공개), siteClosedMessage(비공개 문구), applicationNotice(신청서 제출 동의사항), profileAddOpen, profileEditOpen(프로필 추가/수정 허용), statsEnabled(캐릭터 스탯 사용), specialStats([{ name, enabled }] × 5 — 특별 스탯), siteMusic(유튜브 링크, 빈 값=끔) }` 조회/변경 (보낸 값만) |
| GET | `/api/admin/attributes` | (관리자) 전체 항목, 비활성 포함 |
| POST | `/api/admin/attributes` | (관리자) `{ category: stat/detail, code, label, valueType, options, isRequired, sortOrder }` 항목 추가 |
| PATCH | `/api/admin/attributes/:id` | (관리자) `{ label, valueType, options, isRequired, sortOrder, isActive }` 수정 |
| DELETE | `/api/admin/attributes/:id` | (관리자) 항목 + 저장된 값 삭제 |
| POST | `/api/uploads` | 이미지 업로드 (multipart `file`, png/jpg/gif/webp, 5MB) → `{ url }` |
| GET | `/api/boards/:board/posts?page=` | 목록 (board: qna). `pinned`(메인 글) 포함, 비밀글은 가려짐 |
| GET | `/api/boards/:board/posts/:id` | 글 보기 (+ Q&A 답변) |
| GET | `/api/boards/:board/write-access` | 지금 글을 쓸 수 있는지 `{ canWrite, guestWrite(비회원으로 쓰는지) }` |
| POST/PUT/DELETE | `/api/boards/:board/posts[/:id]` | `{ title, body, isHidden, password?, guestName?(비회원), removePassword?(수정) }` — 회원 작성자 / 비회원 글은 비밀번호 확인한 사람 / 관리자 |
| POST | `/api/boards/:board/posts/:id/verify` | 글 비밀번호 확인 `{ password }` → 이 세션에서 비밀글 보기 · 비회원 글 수정·삭제 가능 |
| PUT | `/api/boards/qna/posts/:id/pin` | (관리자) `{ isPinned }` 메인 글 지정/해제 |
| POST | `/api/boards/qna/posts/:id/replies` | (관리자) 답변 → 질문자에게 알림 |
| PUT/DELETE | `/api/boards/qna/replies/:id` | (관리자) 답변 수정/삭제 |
| GET/POST/PUT/DELETE | `/api/admin/items[/:id]` | (관리자) 아이템 목록/등록/수정/삭제 |
| GET | `/api/admin/characters?q=` | (관리자) 캐릭터 검색 |
| GET/POST | `/api/admin/characters/:id/inventory` | (관리자) 인벤토리 조회 / 지급 `{ itemId, quantity, memo(획득처) }` (알림 발송, 조회 응답에 itemLogs 포함) |
| DELETE | `/api/admin/characters/:id/inventory/:itemId?quantity=&memo=` | (관리자) 회수 (memo: 사유) |
| GET | `/api/inventory/:itemId/logs` | 내 아이템 하나의 습득/사용 기록 |
| GET | `/api/members?q=&page=` | 멤버란 목록 (캐릭터 이름 검색, 24개씩) |
| GET | `/api/members/:id` | 캐릭터 상세 (기본정보·스탯·프로필, 계정 정보·인벤토리 제외) |
| GET | `/api/shop` | 판매 중인 상품 (+ 로그인 시 내 `money`) |
| POST | `/api/shop/:id/buy` | 구매 `{ quantity }` — 소지금·재고 차감 + 인벤토리 지급 (한 트랜잭션) |
| GET/POST/PUT/DELETE | `/api/admin/shop[/:id]` | (관리자) 상점 상품 `{ itemId, price, stock(빈값=무제한), isActive, sortOrder }` |
| POST | `/api/admin/characters/:id/money` | (관리자) 소지금 지급/회수 `{ amount(+/-), memo }` (알림 발송) |
| GET | `/api/inventory` | 내 캐릭터 인벤토리 + `money` + `moneyLogs` |
| POST | `/api/inventory/:itemId/discard` | `{ quantity }` 버리기 |
| GET | `/api/notifications` | 내 알림 50개 + `unreadCount` |
| POST | `/api/notifications/:id/read`, `/read-all` | 읽음 처리 |
| GET | `/api/health` | 헬스체크 |

## 알림 보내기 (서버 공용 함수)

`server/src/notify.js` — 어느 라우트/스크립트에서든 불러서 `notifications` 테이블에 알림을 추가합니다.

```js
const { notify, notifyUsers, notifyAdmins } = require('../notify');   // routes/ 기준 경로

// 한 명에게 (link: 눌렀을 때 이동할 사이트 내부 주소)
await notify({ userId, message: '캐릭터 승인이 완료되었습니다.', link: '/mypage' });

// 게시글 관련 (link 생략 시 글 주소로 이동, 글이 삭제되면 알림도 삭제)
await notify({ userId: post.user_id, type: 'qna_reply', postId: post.id, message: '답변이 달렸습니다.' });

// 여러 명 / 관리자 전체 (exceptUserId: 제외할 회원)
await notifyUsers([1, 2, 3], { type: 'event', message: '이벤트 시작!', link: '/notice' });
await notifyAdmins({ type: 'qna_new', message: '새 질문이 올라왔습니다.', postId }, { exceptUserId: req.session.userId });

// 트랜잭션 안에서는 커넥션을 마지막 인자로 → 작업이 실패하면 알림도 함께 취소
await withTransaction(async (conn) => { /* ... */ await notify({ userId, message }, conn); });
```

| 옵션 | 설명 |
|---|---|
| `userId` | 받는 회원 id (notify 필수) |
| `message` | 알림 문구 (필수, 255자 초과분은 잘림) |
| `type` | 종류 (영문 소문자/숫자/_ 30자, 기본 `general`) |
| `postId` | 관련 게시글 id (선택) |
| `link` | 이동할 주소, `/` 로 시작하는 사이트 내부 주소만 (선택) |

## 아이템 지급/회수 (서버 공용 함수)

`server/src/inventory.js` — 보상 지급 등 다른 기능에서 불러 씁니다.

```js
const { giveItem, takeItem, getInventory } = require('../inventory');
await giveItem({ characterId, itemId, quantity: 2, notifyUser: true });   // 지급 (+ 알림) → 보유 수량
await takeItem({ characterId, itemId, quantity: 1 });                     // 회수/사용 → 남은 수량 (0 이면 삭제)
await getInventory(characterId);                                          // [{ item, quantity, acquiredAt }]
```

## 소지금 (서버 공용 함수)

`server/src/money.js` — 보상·거래 등 다른 기능에서 불러 씁니다. 모든 변화는 `money_logs` 에 기록됩니다.

```js
const { getMoney, changeMoney, getMoneyLogs } = require('../money');
await changeMoney({ characterId, amount: 500, reason: 'event', memo: '출석 보상' });   // → 잔액
await changeMoney({ characterId, amount: -300, reason: 'shop_buy', memo: '포션 x3' });  // 부족하면 400
```

## 로컬 개발

MySQL 에 `projectq` DB 와 계정을 만든 뒤:

```bash
cp server/.env.example server/.env   # DB 정보 입력
cd server && npm install && npm run migrate && npm run seed && npm run dev
cd client && npm install && npm run dev   # http://localhost:5173 (/api 는 3000 으로 프록시)
```

## 배포

[docs/EC2_SETUP.md](docs/EC2_SETUP.md) 참고 (Amazon Linux 2023 기준). ① 마운트 → ② 기본 세팅 → ③ 불러오기 순서이며,
코드·DB·설정·로그 모두 `/data` (Instance Store) 에 저장됩니다. 세팅 후에는 아래 한 줄로 업데이트합니다.

```bash
node /data/deploy.js
```
