# DB 구조 (MySQL 8)

```
users                          characters (계정당 1개)
─────────────────────          ─────────────────────
id            PK          ┌──  id            PK
username      UNIQUE(아이디)│    user_id       UNIQUE, FK → users.id
contact       소통 계정   │    name          캐릭터 이름   ┐ 기본정보
role          admin/      │    hp            HP           ┘
              member/     │    application_status  신청 상태(작성중/작성완료)
              applicant   │
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

character_stats (캐릭터당 1세트)      character_profiles (캐릭터당 여러 개, 최대 10)
─────────────────────              ─────────────────────
character_id   FK → characters     id, character_id FK → characters
definition_id  FK → attribute_…    name (추가 프로필 이름 — 대표는 캐릭터 이름으로 표시), is_main (대표 1개), sort_order
value          TEXT
PK(character_id, definition_id)    character_details (프로필 양식 값, 프로필마다)
                                   ─────────────────────
                                   profile_id     FK → character_profiles (삭제 시 함께 삭제)
                                   definition_id  FK → attribute_…
                                   value          TEXT
                                   PK(profile_id, definition_id)

settings  (전역 설정 키-값)  stat_initial_points = 초기 투자 포인트
posts          게시글  board: qna(Q&A) — 화면에서 쓰는 게시판은 Q&A 뿐
               (notice/world/guide/free 는 이전 버전 데이터용으로 남아 있음, 화면에 표시 안 함)
               is_hidden(Q&A 비밀글), is_pinned(Q&A 메인 글), user_id FK → users.id (비회원 글이면 NULL)
               guest_name(비회원 이름), password_hash(글 비밀번호, scrypt — 비회원 글 필수, 회원 비밀글 선택)
post_replies   Q&A 답변 (관리자)  post_id FK → posts.id (글 삭제 시 함께 삭제)
notifications  계정별 알림  user_id, type, post_id, link(이동 주소), message, is_read
               → 추가는 server/src/notify.js 의 notify()/notifyUsers()/notifyAdmins() 사용
items          아이템 (uid=id, name, description(마크다운), small_image, large_image,
               effect ENUM(none/hp_recover/stat_bonus/custom), effect_values JSON, is_bound 귀속, is_sellable 판매가능)
inventory      캐릭터 인벤토리 (캐릭터 귀속)  character_id, item_id, quantity — (character_id, item_id) UNIQUE, 수량으로 쌓임
               → 지급/회수는 server/src/inventory.js 의 giveItem()/takeItem()/getInventory() 사용
character_profiles.music_video_id  프로필 음악 (유튜브 영상 ID, NULL = 없음)
users.music_volume / music_enabled  계정별 음악 볼륨(0~100) / 재생 여부
settings.site_music                 사이트 전체 음악 (유튜브 영상 ID)
settings.site_name                  사이트 이름 (없으면 ProjectQ)
settings.site_private               회원 전용 모드 ('1' = 로그인해야 이용, 없거나 '0' = 공개)
settings.qna_guest_write            Q&A 비회원 글쓰기 허용 ('1' 허용, 없거나 '0' 막음)
settings.site_favicon               파비콘(브라우저 탭 아이콘): 업로드 이미지 경로 ico/png 등 (없으면 없음)
characters.money  소지금 (캐릭터 귀속)
content_pages  콘텐츠 페이지  slug(PK: notice/world/system/guide), title, description, body(마크다운), music_video_id
item_logs      아이템 습득/사용 기록  character_id, item_id, amount(+/-), quantity_after, source(admin/shop/admin_take/discard/legacy ...),
               memo(획득처 상세), actor_user_id(처리한 사람), created_at(언제)
               inventory 는 현재 보유(아이템별 한 줄: acquired_at 처음 / last_acquired_at 마지막 습득)
money_logs     소지금 내역  character_id, amount(+/-), balance(변화 후 잔액), reason(admin/shop_buy/...), memo
               → 변경은 server/src/money.js 의 changeMoney() 사용 (잔액 확인 + 내역 기록 + 행 잠금)
shop_items     상점 상품  item_id(UNIQUE, FK → items), price, stock(NULL=무제한), is_active, sort_order
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
- **투자 포인트**: `숫자` 형식의 캐릭터 스탯은 포인트를 나눠 주는 스탯 — 값은 0 이상의 정수, 사용 중인 항목 값의 합계 ≤ `settings.stat_initial_points` (관리자 페이지에서 설정)
- 로그인은 `users.username`(아이디, 영문·숫자·_ 4~20자, 대소문자 구분 없이 중복 불가, 변경 불가) + 비밀번호. 이메일·이름은 016 에서 삭제
  (기존 회원 아이디 = 이메일 @ 앞부분, 짧으면 user<번호>, 겹치면 _<번호>). `contact` = 소통 계정
- 회원가입 안내(주의문구)는 `settings.signup_notice` (마크다운)
- 권한(`users.role`): `admin` 관리자 / `member` 멤버 / `applicant` 신청자. 가입 시 권한은 서버 설정 `SIGNUP_ROLE` (기본 `applicant`)
  - 멤버란에는 `admin`, `member` 의 캐릭터만 보임. 신청자는 프로필 1개만
  - `characters.application_status`: `draft` 작성중 / `submitted` 작성완료 (신청자만 의미, 작성완료면 수정 잠금), `submitted_at` 제출 시각
  - 관리자가 멤버로 전환하면 `role = 'member'`, 신청 프로필이 대표 프로필. 삭제하면 캐릭터·프로필만 삭제(계정은 남음)
  - 기존 `user`(일반) 계정은 011 마이그레이션에서 `member` 로 바뀜

## 마이그레이션 규칙
- `migrations/` 안의 `.sql` 파일을 **파일명 순서대로** 실행합니다.
- 실행된 파일 이름은 `schema_migrations` 테이블에 기록되어 **한 번만** 실행됩니다.
- 이미 적용된 파일은 수정하지 말고, 변경사항은 `004_add_xxx.sql` 처럼 다음 번호의 새 파일로 추가하세요.
- 실행: `cd server && npm run migrate` (배포 스크립트 `deploy/deploy.js` 가 자동으로 실행)
- **phpMyAdmin 등에서 테이블을 직접 삭제(DROP)하지 마세요.** 마이그레이션은 다시 실행되지 않아서 테이블이 저절로 생기지 않고, 그 기능은 서버 오류가 납니다.
  `migrate.js` 는 끝날 때 필요한 테이블이 다 있는지 확인해서 빠진 테이블을 경고합니다. (내용만 비우려면 DROP 대신 `TRUNCATE`)
