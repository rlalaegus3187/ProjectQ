# ProjectQ

Vue 3 + Node.js/Express + MySQL 로 만든 SPA 로그인 샘플입니다.

- 세션 기반 로그인 (HttpOnly 쿠키, 세션은 MySQL 에 저장 → 재시작해도 로그인 유지)
- 회원가입 / 로그인 / 로그아웃 / 샘플 게시판
- **계정당 캐릭터 1개** — 가입할 때 함께 등록, 로그인하면 마이페이지에서 내 캐릭터(기본정보/스탯/세부정보) 표시·수정
- **관리자/일반 권한** (지금은 가입하면 모두 관리자) — 관리자는 `/admin` 에서 수집할 스탯/세부정보 항목 관리
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
│     ├─ components/       CharacterForm(입력), CharacterCard(표시)
│     └─ views/            Home, Login, Signup, MyPage, Admin
├─ server/                 Express API
│  ├─ src/
│  │  ├─ index.js          앱 진입점 (세션, 라우트)
│  │  ├─ characters.js     캐릭터/항목 정의 검증·저장 로직
│  │  ├─ routes/auth.js    /api/auth/signup, login, logout, me
│  │  ├─ routes/characters.js  /api/attributes, /api/characters
│  │  ├─ routes/admin.js   /api/admin/attributes (관리자)
│  │  └─ routes/posts.js   /api/posts (샘플)
│  ├─ scripts/migrate.js   DB 마이그레이션
│  └─ scripts/seed.js      샘플 계정 생성
├─ db/                    MySQL 스키마 (구조 설명: db/README.md)
│  └─ migrations/          001_init.sql, 002_characters.sql …
├─ deploy/
│  ├─ mount-instance-store.sh  ① NVMe Instance Store → /data 마운트
│  ├─ setup-server.sh      ② EC2 기본 세팅 (Node, MySQL 데이터·임시파일·로그→/data, Nginx, PM2)
│  ├─ deploy.js            ③ git clone/pull → 설치 → 마이그레이션 → 빌드 → 재시작
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
| GET | `/api/attributes` | 현재 입력받는 스탯/세부정보 항목 `{ stats, details }` |
| GET | `/api/characters/me` | 내 캐릭터 (없으면 `character: null`) |
| POST | `/api/characters` | 캐릭터 등록 (계정당 1개, 이미 있으면 409) |
| PUT | `/api/characters/me` | 내 캐릭터 수정 |
| GET | `/api/admin/attributes` | (관리자) 전체 항목, 비활성 포함 |
| POST | `/api/admin/attributes` | (관리자) `{ category: stat/detail, code, label, valueType, isRequired, sortOrder }` 항목 추가 |
| PATCH | `/api/admin/attributes/:id` | (관리자) `{ label, isRequired, sortOrder, isActive }` 수정 |
| GET | `/api/posts` | 게시글 목록 |
| POST | `/api/posts` | `{ title, body }` (로그인 필요) |
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
