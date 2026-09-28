# ProjectQ

Vue 3 + Node.js/Express + MySQL 로 만든 SPA 로그인 샘플입니다.

- 세션 기반 로그인 (HttpOnly 쿠키, 세션은 MySQL 에 저장 → 재시작해도 로그인 유지)
- 회원가입 / 로그인 / 로그아웃 / 마이페이지(로그인 필요) / 샘플 게시판
- EC2(m6id Instance Store) 배포 스크립트와 **`deploy.js` 한 번으로 전체 업데이트**

## 폴더 구조

```
ProjectQ/
├─ client/                 Vue 3 + Vite + vue-router
│  └─ src/
│     ├─ api.js            fetch 래퍼 (/api 호출)
│     ├─ auth.js           로그인 상태(user) 관리
│     ├─ router.js         라우트 + 로그인 가드
│     └─ views/            Home, Login, Signup, MyPage
├─ server/                 Express API
│  ├─ src/
│  │  ├─ index.js          앱 진입점 (세션, 라우트)
│  │  ├─ routes/auth.js    /api/auth/signup, login, logout, me
│  │  └─ routes/posts.js   /api/posts (샘플)
│  ├─ scripts/migrate.js   DB 마이그레이션
│  └─ scripts/seed.js      샘플 계정 생성
├─ db/migrations/          MySQL 스키마 (001_init.sql …)
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
| POST | `/api/auth/signup` | `{ name, email, password }` 가입 후 자동 로그인 |
| POST | `/api/auth/login` | `{ email, password }` |
| POST | `/api/auth/logout` | 세션 삭제 |
| GET | `/api/auth/me` | 현재 로그인 사용자 (401 이면 비로그인) |
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
