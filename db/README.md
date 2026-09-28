# DB 구조 (MySQL 8)

```
users                          characters (계정당 1개)
─────────────────────          ─────────────────────
id            PK          ┌──  id            PK
email         UNIQUE      │    user_id       UNIQUE, FK → users.id
name                      │    name          캐릭터 이름   ┐ 기본정보
role          admin/user  │    hp            HP           ┘
password_hash (scrypt)    │
created_at ...            │
                          │
attribute_definitions  ← "어떤 스탯/세부정보를 수집할지" 정의 (관리자 페이지에서 관리)
─────────────────────
id            PK
category      stat / detail
code          프로그램용 키 (예: str, original_name) — category 안에서 UNIQUE
label         화면 표시 이름 (예: 힘, 원문 이름)
value_type    number / text (스탯은 항상 number)
is_required   필수 여부
sort_order    표시 순서
is_active     0 이면 숨김 (저장된 값은 보존)

character_stats                    character_details
─────────────────────              ─────────────────────
character_id   FK → characters     character_id   FK → characters
definition_id  FK → attribute_…    definition_id  FK → attribute_…
value          INT                 value          TEXT
PK(character_id, definition_id)    PK(character_id, definition_id)

posts     (샘플 게시판)  user_id FK → users.id
sessions  (express-mysql-session 로그인 세션)
```

- 기본 세부정보 항목: `original_name`(원문 이름, 텍스트), `age`(나이, 숫자) — `002_characters.sql` 에서 등록
- 스탯 항목은 관리자 페이지(`/admin`)에서 추가하거나 SQL 로 넣으면 입력폼/표시에 자동 반영:
  ```sql
  INSERT INTO attribute_definitions (category, code, label, value_type, is_required, sort_order)
  VALUES ('stat', 'str', '힘', 'number', 1, 10);
  ```
- 가입 시 권한은 서버 설정 `SIGNUP_ROLE` (기본 `admin` = 지금은 가입하면 모두 관리자)

## 마이그레이션 규칙
- `migrations/` 안의 `.sql` 파일을 **파일명 순서대로** 실행합니다.
- 실행된 파일 이름은 `schema_migrations` 테이블에 기록되어 **한 번만** 실행됩니다.
- 이미 적용된 파일은 수정하지 말고, 변경사항은 `003_add_xxx.sql` 처럼 새 파일로 추가하세요.
- 실행: `cd server && npm run migrate` (배포 스크립트 `deploy/deploy.js` 가 자동으로 실행)
