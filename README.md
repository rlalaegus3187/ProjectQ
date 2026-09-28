# ProjectQ

Vue 3 + Node.js/Express + MySQL 로 만든 SPA 로그인 샘플입니다.

- 세션 기반 로그인 (HttpOnly 쿠키, 세션은 MySQL 에 저장 → 재시작해도 로그인 유지)
- 회원가입 / 로그인 / 로그아웃
- **게시판**: 공지 · 세계관 · 캐릭터 가이드 (관리자 작성, 마크다운 등록툴 + 이미지), **Q&A** (회원 질문·비밀글, 관리자 답변·메인 글)
- **알림**: 내 Q&A 질문에 답변이 달리면 상단 `알림` 에 표시
- **계정당 캐릭터 1개** — 가입할 때 함께 등록, 로그인하면 마이페이지에서 내 캐릭터(기본정보/캐릭터 스탯/프로필) 표시·수정
- **관리자/일반 권한** (지금은 가입하면 모두 관리자) — 관리자는 `/admin` 에서 캐릭터 스탯·프로필 양식 항목을 추가/수정/삭제
- 항목 형식: 숫자, 짧은 텍스트, 긴 텍스트, 링크, 이미지(업로드), 드롭다운
- **스탯 투자 포인트**: 관리자가 초기 투자 포인트를 정하고, 캐릭터는 숫자형 스탯에 포인트를 나눠 투자 (합계 ≤ 전체 포인트)
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
│     ├─ components/       CharacterForm/CharacterCard, AttributeInput/AttributeValue(형식별 입력·표시)
│     └─ views/            Home, Login, Signup, MyPage, Admin(항목/게시글), Board*/Post*, Notifications
├─ server/                 Express API
│  ├─ src/
│  │  ├─ index.js          앱 진입점 (세션, 라우트)
│  │  ├─ characters.js     캐릭터/항목 정의 검증·저장 로직
│  │  ├─ routes/auth.js    /api/auth/signup, login, logout, me
│  │  ├─ routes/characters.js  /api/attributes, /api/characters
│  │  ├─ routes/admin.js   /api/admin/attributes (관리자)
│  │  ├─ routes/uploads.js /api/uploads (이미지 업로드/제공)
│  │  ├─ routes/boards.js  /api/boards (공지/세계관/캐릭터 가이드/Q&A)
│  │  └─ routes/notifications.js  /api/notifications
│  ├─ scripts/migrate.js   DB 마이그레이션
│  └─ scripts/seed.js      샘플 계정 생성
├─ db/                    MySQL 스키마 (구조 설명: db/README.md)
│  └─ migrations/          001_init.sql … 005_boards.sql
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
| POST | `/api/auth/signup` | `{ name, email, password, character: { name, hp, stats: {code: 값}, details: {code: 값} } }` 가입 + 캐릭터 등록 후 자동 로그인 |
| POST | `/api/auth/login` | `{ email, password }` |
| POST | `/api/auth/logout` | 세션 삭제 |
| GET | `/api/auth/me` | 현재 로그인 사용자 `{ id, email, name, role }` (401 이면 비로그인) |
| GET | `/api/attributes` | 현재 입력받는 항목 + 투자 포인트 `{ stats, details, statPoints }` |
| GET | `/api/characters/me` | 내 캐릭터 (없으면 `character: null`) |
| POST | `/api/characters` | 캐릭터 등록 (계정당 1개, 이미 있으면 409) |
| PUT | `/api/characters/me` | 내 캐릭터 수정 |
| GET/PUT | `/api/admin/settings` | (관리자) 초기 투자 포인트 `{ statPoints }` 조회/변경 |
| GET | `/api/admin/attributes` | (관리자) 전체 항목, 비활성 포함 |
| POST | `/api/admin/attributes` | (관리자) `{ category: stat/detail, code, label, valueType, options, isRequired, sortOrder }` 항목 추가 |
| PATCH | `/api/admin/attributes/:id` | (관리자) `{ label, valueType, options, isRequired, sortOrder, isActive }` 수정 |
| DELETE | `/api/admin/attributes/:id` | (관리자) 항목 + 저장된 값 삭제 |
| POST | `/api/uploads` | 이미지 업로드 (multipart `file`, png/jpg/gif/webp, 5MB) → `{ url }` |
| GET | `/api/boards/:board/posts?page=` | 목록 (board: notice/world/guide/qna). Q&A 는 `pinned`(메인 글) 포함, 비밀글은 가려짐 |
| GET | `/api/boards/:board/posts/:id` | 글 보기 (+ Q&A 답변) |
| POST/PUT/DELETE | `/api/boards/:board/posts[/:id]` | `{ title, body, isHidden }` — 공지/세계관/가이드는 관리자, Q&A 는 작성자(또는 관리자) |
| PUT | `/api/boards/qna/posts/:id/pin` | (관리자) `{ isPinned }` 메인 글 지정/해제 |
| POST | `/api/boards/qna/posts/:id/replies` | (관리자) 답변 → 질문자에게 알림 |
| PUT/DELETE | `/api/boards/qna/replies/:id` | (관리자) 답변 수정/삭제 |
| GET | `/api/notifications` | 내 알림 50개 + `unreadCount` |
| POST | `/api/notifications/:id/read`, `/read-all` | 읽음 처리 |
| GET | `/api/health` | 헬스체크 |

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
