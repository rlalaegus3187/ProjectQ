# DB 구조 (MySQL 8)

```
users                         posts
─────────────────────         ─────────────────────
id            PK              id          PK
email         UNIQUE          user_id     FK → users.id
name                          title
password_hash (scrypt)        body
created_at                    created_at
updated_at
last_login_at

sessions   (express-mysql-session 이 로그인 세션 저장)
─────────────────────
session_id  PK
expires
data
```

## 마이그레이션 규칙
- `migrations/` 안의 `.sql` 파일을 **파일명 순서대로** 실행합니다.
- 실행된 파일 이름은 `schema_migrations` 테이블에 기록되어 **한 번만** 실행됩니다.
- 이미 적용된 파일은 수정하지 말고, 변경사항은 `002_add_xxx.sql` 처럼 새 파일로 추가하세요.
- 실행: `cd server && npm run migrate` (배포 스크립트 `deploy/deploy.js` 가 자동으로 실행)
