# ProjectQ

Vue 3 + Node.js/Express + MySQL 로 만든 SPA 로그인 샘플입니다.

- 세션 기반 로그인 (HttpOnly 쿠키, 세션은 MySQL 에 저장 → 재시작해도 로그인 유지)
- **아이디 + 비밀번호 로그인** (이메일·이름 없음). 회원가입은 아이디 / 비밀번호 / 소통 계정 + 가입 안내(주의문구) 동의 — 안내는 관리 → 사이트 설정에서 작성
  - 마이페이지 **약관동의 (완료)** 를 누르면 가입 때 동의한 안내를 팝업으로 다시 봄 (동의한 그때 내용 그대로 저장). 기록이 없는 기존 회원은 (미완료) → 팝업에서 동의
  - 아이디는 바꿀 수 없음, 비밀번호·소통 계정은 마이페이지에서 변경. 관리 → 회원 관리에서 비밀번호 강제 변경
  - 캐릭터는 가입한 뒤 마이페이지에서 작성
- **콘텐츠 페이지**: 공지 · 세계관 · 시스템 · 캐릭터 가이드 — 내용은 DB, **관리 → 페이지 관리** 한 곳에서 마크다운으로 작성(페이지별 음악 지정 가능), 화면은 `ContentPage.vue` 하나가 표시
- **마크다운 편집기**: 제목·굵게·기울임·취소선·목록·인용·링크·이미지 (`client/src/markdown/README.md`)
- **Q&A 게시판**: 회원 질문·비밀글, 관리자 답변·메인 글 (마크다운 등록툴 + 이미지)
  - **비회원 질문**: 관리 → 사이트 설정의 스위치로 켜고 끔. 비회원은 이름 + 비밀번호로 작성(공개/비밀글), 비밀번호로 비밀글 보기·수정·삭제
  - **글 비밀번호**: 회원 비밀글에도 선택으로 걸 수 있음 → 비밀번호를 아는 사람은 로그인 없이 볼 수 있음
- **알림**: 내 Q&A 질문에 답변이 달리면 상단 `알림` 에 표시
- **음악**: 프로필별 유튜브 음악, 사이트 전체 음악(관리 → 사이트 설정), 페이지별 음악(`usePageMusic`) — 오른쪽 아래 플레이어, 볼륨/정지는 계정별 저장 (`client/src/music/README.md`)
- **소지금 / 상점**: 캐릭터 소지금(내역 기록), 관리자가 소지금 지급·회수, `상점 관리`에서 등록된 아이템을 골라 가격·재고 설정, 회원은 `상점`에서 구매
- **아이템 / 인벤토리**: 관리자가 아이템 등록(이미지·효과·귀속·판매가능) 후 캐릭터에게 지급/회수, 회원은 `인벤토리` 에서 확인·버리기
  - **습득 기록**: 모든 습득·사용이 `item_logs` 에 언제·어디서(관리자 지급/상점 구매/버림 ...)·메모·처리한 사람과 함께 남음. 관리자 지급 때 획득처(예: 이벤트 보상) 입력
- **계정당 캐릭터 1개** — 가입할 때 함께 등록, 마이페이지에서 기본정보·캐릭터 스탯 표시·수정
- **멤버란** (`/members`): 전체 캐릭터 목록(대표 프로필 이미지·검색) + 캐릭터 상세(기본정보·스탯·프로필, 보기 전용, 로그인 없이 공개)
- **캐릭터 프로필 여러 개** (최대 10) — 프로필 양식 값만 프로필마다 따로, 대표 프로필 지정 (스탯·인벤토리는 캐릭터에 하나)
- **권한 3단계: 관리자 / 멤버 / 신청자** — 가입하면 신청자(프로필 1개, 멤버란에 안 보임). 신청자는 마이페이지에서 신청서를 `작성중 ↔ 작성완료` 로 바꾸고(작성완료면 수정 잠금),
  관리자는 `관리 → 신청자 관리`에서 신청 프로필을 보고 **체크해서 한꺼번에 멤버로 전환**(신청 프로필이 대표 프로필, 멤버란 공개, 알림) 또는 **한꺼번에 삭제**
- 관리자는 `관리 → 캐릭터 항목 관리`(`/admin/attributes`) 에서 캐릭터 스탯·프로필 양식 항목을 추가/수정/삭제
- 항목 형식: 숫자, 짧은 텍스트, 긴 텍스트(마크다운 편집기), 링크, 이미지(업로드), 드롭다운
- **스탯 투자 포인트**: 관리자가 초기 투자 포인트를 정하고, 캐릭터는 숫자형 스탯에 포인트를 나눠 투자 (합계 ≤ 전체 포인트)
- **사이트 오픈 / 클로즈 (회원 전용)**: 관리 → 사이트 설정의 스위치. 켜면 로그인하지 않은 방문자는 메뉴 없는 입장(로그인) 화면만 보고, 서버 API 도 로그인·회원가입 등 일부만 허용
- **사이트 이름 · 파비콘**: 관리 → 사이트 설정에서 이름(상단 로고·탭 제목)과 파비콘(ico/png 업로드, 브라우저 탭 아이콘)을 설정
- EC2(m6id Instance Store) 배포 스크립트와 **`deploy.js` 한 번으로 전체 업데이트**

## 폴더 구조

```
ProjectQ/
├─ client/                 Vue 3 + Vite + vue-router
│  └─ src/
│     ├─ api.js            fetch 래퍼 (/api 호출)
│     ├─ auth.js           로그인 상태(user) 관리
│     ├─ router.js         라우트 + 로그인/관리자 가드
│     ├─ character.js      캐릭터 폼 헬퍼
│     ├─ menu.js           상단 메뉴 목록
│     ├─ markdown/         ★ 마크다운 모듈 (renderMarkdown, MarkdownEditor, MarkdownView) — markdown/README.md
│     ├─ music/            ★ 음악 모듈 (MusicPlayer, usePageMusic, setSiteMusic, 볼륨/정지) — music/README.md
│     ├─ upload.js         이미지 업로드
│     ├─ contents.js       콘텐츠 페이지 slug 목록 + 메뉴 제목
│     ├─ site.js           사이트 이름·파비콘 (상단 로고, 브라우저 탭)
│     ├─ layouts/          여러 페이지 공통 바깥 틀 (AdminLayout = 관리 메뉴)
│     ├─ pages/            주소 1개 = *Page.vue 1개, 기능별 폴더 (home, auth, mypage, members, shop, board, content, admin) — pages/README.md
│     └─ components/       여러 페이지에서 쓰는 부품 (PageContainer, CharacterForm/Card, AttributeInput/Value, PostEditor ...)
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
│  │  ├─ routes/contents.js    /api/contents, /api/admin/contents (콘텐츠 페이지)
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
| GET | `/api/auth/signup-info` | 회원가입 안내(주의문구, 마크다운) `{ notice }` |
| POST | `/api/auth/signup` | `{ username, password, contact, agree: true }` 가입 후 자동 로그인 (신청자, 캐릭터는 마이페이지에서) |
| POST | `/api/auth/login` | `{ username, password }` |
| PUT | `/api/auth/me` | 소통 계정 수정 `{ contact }` (아이디는 변경 불가) |
| GET/PUT | `/api/auth/me/agreement` | 내가 동의한 안내 `{ agreedAt, notice }` / 기록이 없으면 지금 안내에 동의 `{ agree: true }` |
| PUT | `/api/auth/me/password` | 비밀번호 변경 `{ currentPassword, newPassword }` → 다른 기기 로그아웃 |
| GET | `/api/admin/users?q=&role=&page=` | (관리자) 회원 목록 |
| PUT | `/api/admin/users/:id/password` | (관리자) 비밀번호 강제 변경 `{ newPassword }` → 그 회원 로그아웃 + 알림 |
| POST | `/api/auth/logout` | 세션 삭제 |
| PUT | `/api/auth/me/preferences` | 계정 음악 설정 `{ musicVolume(0~100), musicEnabled }` |
| GET | `/api/settings` | 공개 설정 `{ siteName, siteFavicon, siteMusic, qnaGuestWrite, sitePrivate }` (회원 전용 모드에서도 로그인 없이 조회 가능) (사이트 이름·파비콘, 사이트 전체 음악 영상 ID) |
| GET | `/api/auth/me` | 현재 로그인 사용자 `{ id, username, contact, role }` (401 이면 비로그인) |
| GET | `/api/attributes` | 현재 입력받는 항목 + 투자 포인트 `{ stats, details, statPoints }` |
| GET | `/api/characters/me` | 내 캐릭터 (없으면 `character: null`) |
| POST | `/api/characters` | 캐릭터 등록 `{ name, hp, stats, details }` → 대표 프로필(캐릭터 이름으로 표시) 함께 생성 (계정당 1개) |
| PUT | `/api/characters/me` | 기본정보 + 스탯 수정 `{ name, hp, stats }` |
| POST | `/api/characters/me/profiles` | 프로필 추가 `{ name, music?(유튜브 링크), details }` |
| PUT/DELETE | `/api/characters/me/profiles/:id` | 프로필 수정 `{ name, details }` (대표는 name 없음) / 삭제 (대표는 삭제 불가) |
| PUT | `/api/characters/me/profiles/:id/main` | 대표 프로필 지정 |
| PUT | `/api/characters/me/application` | (신청자) 신청 상태 `{ status: draft(작성중) / submitted(작성완료) }` — 작성완료면 캐릭터·프로필 수정 불가(409), 관리자에게 알림 |
| GET | `/api/contents`, `/api/contents/:slug` | 콘텐츠 페이지 목록(제목) / 내용 `{ slug, title, description, body(마크다운), musicVideoId }` |
| GET/PUT | `/api/admin/contents[/:slug]` | (관리자) 콘텐츠 페이지 목록 / 저장 `{ title, description, body, music(유튜브 링크) }` |
| GET | `/api/admin/applicants?status=&q=` | (관리자) 신청자 캐릭터 목록 + 상태별 개수 |
| GET | `/api/admin/applicants/:id` | (관리자) 신청자 캐릭터·프로필 보기 |
| POST | `/api/admin/applicants/accept` | (관리자) `{ characterIds: [...] }` 한꺼번에 멤버로 전환 (신청 프로필 → 대표 프로필, 알림) |
| POST | `/api/admin/applicants/delete` | (관리자) `{ characterIds: [...] }` 한꺼번에 캐릭터+프로필 삭제 (계정은 남음, 신청자만 처리) |
| GET/PUT | `/api/admin/settings` | (관리자) `{ statPoints, siteName, siteFavicon(업로드한 이미지 경로 — ico/png 등, 빈 값=없음), qnaGuestWrite(Q&A 비회원 글쓰기), sitePrivate(회원 전용), siteMusic(유튜브 링크, 빈 값=끔) }` 조회/변경 (보낸 값만) |
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
