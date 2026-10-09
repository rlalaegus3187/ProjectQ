# css/ — 사이트 테마

배포하면 이 폴더가 그대로 웹 주소 `/css/` 로 올라갑니다.

```
css/
├─ basic/              기본 테마
│  ├─ style.css        모든 화면 공통 — 항상 먼저 적용 (색 변수, 버튼·폼·카드·팝업·배지, 여러 화면이 쓰는 부품)
│  ├─ admin.css        관리 화면(/admin/...)에서만 (관리 메뉴, 표, 일괄 처리, 각 관리 페이지)
│  └─ pages/           그 페이지에서만 — 파일 이름 = client/src/pages/ 아래 .vue 이름
│     ├─ MyPage.css, InventoryPage.css, ShopPage.css, MemberListPage.css, NotificationsPage.css
│     ├─ BoardListPage.css, PostDetailPage.css, PostEditPage.css, ContentPage.css, HomePage.css, SignupPage.css
│     └─ ...
└─ <테마>/             추가 테마 — 관리 → 테마 에서 골라서 적용 (basic 위에 덮어씀)
   ├─ style.css        필수
   ├─ theme.json       선택: { "name": "표시 이름", "description": "설명", "author": "만든 사람" }
   └─ preview.png      선택: 관리 화면 미리보기 그림 (png / jpg / webp, 16:9 권장)
```

## 화면별 CSS (basic/admin.css, basic/pages/*.css)
- 불러오는 순서: `style.css` → `admin.css`(관리 화면일 때) → `pages/<페이지>.css`(그 페이지일 때) → 고른 테마 `style.css`(맨 뒤)
- 그 화면으로 이동할 때 자동으로 붙고, 다른 화면으로 가면 빠집니다 (`client/src/pageCss.js`, 새 css 를 받은 뒤에 화면이 바뀜)
- 어떤 화면이 어떤 파일을 쓰는지는 `client/src/router.js` 의 meta 로 정합니다
  - `meta: { css: 'MyPage' }` → `pages/MyPage.css`
  - `/admin` 부모 라우트의 `meta: { layoutCss: 'admin' }` → 관리 화면 전체에 `admin.css`
- **새 페이지 css 만들기**: `basic/pages/<페이지이름>.css` 파일을 만들고, router.js 의 그 주소에 `css: '<페이지이름>'` 추가
- 여러 화면에서 쓰는 부품(components/)의 모양은 `style.css` 에 둡니다 (한 페이지에서만 쓰는 부품은 그 페이지 css 에 둬도 됨)
- 배포할 때마다 주소 뒤 `?v=<빌드 시각>` 이 바뀌어서 브라우저가 새 파일을 받습니다

## 새 테마 만들기
1. `sample/` 폴더를 복사해서 이름을 바꿉니다. (예: `theme1/`, 폴더 이름은 영문 소문자·숫자·`-`·`_`)
2. `style.css` 에서 **바꿀 것만** 씁니다. basic 이 먼저 깔리고 그 위에 덮어쓰므로 전체를 다시 쓸 필요가 없습니다.
   - 가장 쉬운 방법: `:root { ... }` 의 변수만 바꾸기 (basic/style.css 맨 위에 변수 목록과 설명이 있음)
   - 그 밖의 부분은 basic 과 같은 선택자를 써서 덮어쓰기 (예: `.nav { ... }`)
   - 테마 안의 그림은 `url('./bg.png')` 처럼 상대 경로로
3. 커밋·푸시 → 서버에서 `node /data/deploy.js` → **관리 → 테마** 에 나타남 → 미리보기 → 적용

## 알아둘 점
- 적용한 테마 폴더 이름은 DB `settings.site_theme` 에 저장됩니다. 그 폴더가 없어지면 자동으로 basic 으로 보입니다.
- 테마 css 주소에 `?v=<수정 시각>` 이 붙어서, 파일을 고쳐 배포하면 방문자 브라우저도 새 파일을 받습니다.
- 사이트 전체 공통 스타일을 고치려면 `basic/style.css`, 관리 화면은 `basic/admin.css`, 한 페이지만이면 `basic/pages/<페이지>.css` 를 고칩니다 (모든 테마에 적용됨).
- 테마의 `style.css` 는 맨 마지막에 불러오므로 관리 화면·페이지별 스타일도 같은 선택자로 덮어쓸 수 있습니다.
