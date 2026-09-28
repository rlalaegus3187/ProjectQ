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
attribute_definitions  ← "어떤 캐릭터 스탯 / 프로필 양식을 수집할지" 정의 (관리자 페이지에서 관리)
─────────────────────
id            PK
category      stat(캐릭터 스탯) / detail(프로필 양식)
code          프로그램용 키 (예: str, original_name) — category 안에서 UNIQUE
label         화면 표시 이름 (예: 힘, 원문 이름)
value_type    number(숫자) / text(짧은 텍스트) / long_text(긴 텍스트)
              / link(링크) / image(이미지) / select(드롭다운)
options       드롭다운 선택지 (JSON 문자열 배열, select 일 때만)
is_required   필수 여부
sort_order    표시 순서
is_active     0 이면 숨김 (저장된 값은 보존)

character_stats                    character_details
─────────────────────              ─────────────────────
character_id   FK → characters     character_id   FK → characters
definition_id  FK → attribute_…    definition_id  FK → attribute_…
value          TEXT                value          TEXT
PK(character_id, definition_id)    PK(character_id, definition_id)

posts     (샘플 게시판)  user_id FK → users.id
sessions  (express-mysql-session 로그인 세션)
```

- 기본 프로필 양식: `original_name`(원문 이름, 텍스트), `age`(나이, 숫자) — `002_characters.sql` 에서 등록
- 항목은 관리자 페이지(`/admin`)에서 추가/수정(형식 포함)/삭제하거나 SQL 로 넣으면 입력폼/표시에 자동 반영:
  ```sql
  INSERT INTO attribute_definitions (category, code, label, value_type, is_required, sort_order)
  VALUES ('stat', 'str', '힘', 'number', 1, 10);
  INSERT INTO attribute_definitions (category, code, label, value_type, options, sort_order)
  VALUES ('detail', 'job', '직업', 'select', '["전사","마법사","궁수"]', 20);
  ```
- 형식별 저장 값: 숫자/텍스트는 그대로, 링크는 http(s) URL, 드롭다운은 선택지 중 하나,
  이미지는 업로드한 파일 경로(`/api/uploads/<랜덤>.png`) — 파일은 `/data/uploads` 에 저장
- 형식을 바꿔도 저장된 값은 그대로 두며, 새 형식에 맞지 않는 값은 다음에 캐릭터를 저장할 때 다시 입력받음
- 항목 삭제 시 모든 캐릭터의 해당 값도 함께 삭제 (값을 남기려면 삭제 대신 '사용' 끄기)
- 가입 시 권한은 서버 설정 `SIGNUP_ROLE` (기본 `admin` = 지금은 가입하면 모두 관리자)

## 마이그레이션 규칙
- `migrations/` 안의 `.sql` 파일을 **파일명 순서대로** 실행합니다.
- 실행된 파일 이름은 `schema_migrations` 테이블에 기록되어 **한 번만** 실행됩니다.
- 이미 적용된 파일은 수정하지 말고, 변경사항은 `004_add_xxx.sql` 처럼 다음 번호의 새 파일로 추가하세요.
- 실행: `cd server && npm run migrate` (배포 스크립트 `deploy/deploy.js` 가 자동으로 실행)
