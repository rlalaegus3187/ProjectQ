#!/usr/bin/env bash
# phpMyAdmin 설치 → http://<서버IP>/phpmyadmin  (Amazon Linux 2023, ② setup-server.sh 이후 실행)
#
#   bash setup-phpmyadmin.sh                 # 설치 (+ 웹 관리자 계정이 없으면 만들기)
#   bash setup-phpmyadmin.sh user <아이디>    # 웹 관리자 계정 추가 / 비밀번호 변경
#   bash setup-phpmyadmin.sh deluser <아이디> # 웹 관리자 계정 삭제
#   bash setup-phpmyadmin.sh users           # 웹 관리자 계정 목록
#
# 로그인은 2단계입니다.
#   1) 웹 관리자 계정 (브라우저 로그인 창, Nginx Basic 인증) ← 이 스크립트가 관리
#   2) phpMyAdmin 화면에서 MySQL 계정 로그인 (② 에서 만든 DB 관리자 계정 등)
#
# 접속 IP 제한(권장): PMA_ALLOW_IPS="1.2.3.4 5.6.7.8" bash setup-phpmyadmin.sh
set -euo pipefail

DATA="${DATA:-/data}"
PMA_DIR="$DATA/phpmyadmin"
AUTH_DIR="$DATA/auth"                       # nginx 가 읽을 수 있도록 config(700)와 분리
HTPASSWD="$AUTH_DIR/phpmyadmin.htpasswd"
NGINX_SNIPPET_DIR="/etc/nginx/projectq.d"
NGINX_SITE="/etc/nginx/conf.d/projectq.conf"
PHP_FPM_SOCK="/run/php-fpm/www.sock"
MYSQL_SOCKET="/var/lib/mysql/mysql.sock"
PMA_URL="https://www.phpmyadmin.net/downloads/phpMyAdmin-latest-all-languages.tar.gz"

step() { echo; echo "== $* =="; }

# ---------- 웹 관리자 계정 (htpasswd) ----------
read_password() {
  local pw confirm
  while true; do
    read -rsp "  비밀번호 (8자 이상): " pw; echo >&2
    read -rsp "  비밀번호 확인: " confirm; echo >&2
    [[ "$pw" == "$confirm" ]] || { echo "  비밀번호가 일치하지 않습니다." >&2; continue; }
    [[ ${#pw} -ge 8 ]] || { echo "  8자 이상 입력하세요." >&2; continue; }
    printf '%s' "$pw"
    return
  done
}

check_web_user() {
  if [[ ! "$1" =~ ^[A-Za-z0-9_.-]{1,32}$ ]]; then
    echo "아이디는 영문/숫자/_.- 로 32자 이내여야 합니다: $1" >&2
    exit 1
  fi
}

set_web_user() {
  local user="$1"
  check_web_user "$user"
  echo "웹 관리자 '$user' 비밀번호 설정"
  local pw hash
  pw="$(read_password)"
  # apr1(MD5) 해시: Nginx auth_basic 이 지원하는 형식, 별도 패키지(httpd-tools) 불필요
  hash="$(printf '%s' "$pw" | openssl passwd -apr1 -stdin)"
  sudo mkdir -p "$AUTH_DIR"
  sudo chown root:nginx "$AUTH_DIR"
  sudo chmod 750 "$AUTH_DIR"
  sudo touch "$HTPASSWD"
  local tmp; tmp="$(mktemp)"
  sudo grep -v "^${user}:" "$HTPASSWD" > "$tmp" || true
  echo "${user}:${hash}" >> "$tmp"
  sudo install -m 640 -o root -g nginx "$tmp" "$HTPASSWD"
  rm -f "$tmp"
  echo "웹 관리자 '$user' 저장 완료"
}

case "${1:-install}" in
  user)
    [[ -n "${2:-}" ]] || { echo "사용: bash $0 user <아이디>" >&2; exit 1; }
    set_web_user "$2"; exit 0 ;;
  deluser)
    [[ -n "${2:-}" ]] || { echo "사용: bash $0 deluser <아이디>" >&2; exit 1; }
    check_web_user "$2"
    sudo sed -i "/^${2}:/d" "$HTPASSWD"; echo "웹 관리자 '$2' 삭제 완료"; exit 0 ;;
  users)
    sudo cut -d: -f1 "$HTPASSWD" 2>/dev/null || echo "(없음)"; exit 0 ;;
  install) ;;
  *) echo "알 수 없는 명령: $1" >&2; exit 1 ;;
esac

# ---------- 설치 ----------
if ! mountpoint -q "$DATA"; then
  echo "$DATA 가 마운트되어 있지 않습니다. 먼저 ①, ② 를 실행하세요." >&2
  exit 1
fi
[[ -f "$NGINX_SITE" ]] || { echo "$NGINX_SITE 가 없습니다. 먼저 ② setup-server.sh 를 실행하세요." >&2; exit 1; }

# 웹 관리자 계정이 없으면 먼저 입력받기 (설치 중간에 멈추지 않도록)
if ! sudo test -s "$HTPASSWD"; then
  echo "== phpMyAdmin 웹 관리자 계정 설정 (브라우저 로그인 창에서 사용) =="
  read -rp "  아이디 [pmaadmin]: " WEB_USER
  set_web_user "${WEB_USER:-pmaadmin}"
fi

step "1. PHP 설치"
sudo dnf install -y php-fpm php-mysqlnd php-mbstring php-xml
# 있으면 좋은 확장 (저장소에 없으면 건너뜀)
sudo dnf install -y --setopt=strict=0 php-gd php-intl php-zip php-sodium || true
sudo systemctl enable php-fpm
sudo systemctl restart php-fpm
php -v | head -1

step "2. phpMyAdmin 다운로드 → $PMA_DIR"
if [[ -f "$PMA_DIR/index.php" && "${PMA_UPGRADE:-}" != "1" ]]; then
  echo "이미 설치되어 있습니다. (최신 버전으로 교체: PMA_UPGRADE=1 bash $0)"
else
  work="$(mktemp -d)"
  curl -fsSL "$PMA_URL" -o "$work/pma.tar.gz"
  curl -fsSL "$PMA_URL.sha256" -o "$work/pma.sha256"
  echo "$(awk '{print $1}' "$work/pma.sha256")  $work/pma.tar.gz" | sha256sum -c -
  tar -xzf "$work/pma.tar.gz" -C "$work"
  new_dir="$(find "$work" -maxdepth 1 -type d -name 'phpMyAdmin-*' | head -1)"
  # 업그레이드 시 기존 설정 유지
  [[ -f "$PMA_DIR/config.inc.php" ]] && sudo cp "$PMA_DIR/config.inc.php" "$new_dir/config.inc.php"
  sudo rm -rf "$PMA_DIR.old"
  [[ -d "$PMA_DIR" ]] && sudo mv "$PMA_DIR" "$PMA_DIR.old"
  sudo mv "$new_dir" "$PMA_DIR"
  sudo rm -rf "$PMA_DIR.old" "$work"
  # 설치 마법사(setup)는 쓰지 않으므로 삭제
  sudo rm -rf "$PMA_DIR/setup"
  echo "설치 버전: $(grep -oP "(?<=VERSION = ')[^']+" "$PMA_DIR/libraries/classes/Version.php" 2>/dev/null || echo '?')"
fi

step "3. phpMyAdmin 설정"
sudo mkdir -p "$PMA_DIR/tmp"
sudo chown -R root:root "$PMA_DIR"
sudo chown apache:apache "$PMA_DIR/tmp"
sudo chmod 750 "$PMA_DIR/tmp"
if [[ ! -f "$PMA_DIR/config.inc.php" ]]; then
  SECRET="$(openssl rand -base64 24)"   # 32자
  sudo tee "$PMA_DIR/config.inc.php" >/dev/null <<PHP
<?php
// ProjectQ: setup-phpmyadmin.sh 가 생성
declare(strict_types=1);

\$cfg['blowfish_secret'] = '${SECRET}';

\$i = 1;
\$cfg['Servers'][\$i]['auth_type'] = 'cookie';
// 소켓으로 접속 → MySQL 계정의 'user'@'localhost' 로 로그인
\$cfg['Servers'][\$i]['host'] = 'localhost';
\$cfg['Servers'][\$i]['socket'] = '${MYSQL_SOCKET}';
\$cfg['Servers'][\$i]['AllowNoPassword'] = false;
\$cfg['Servers'][\$i]['AllowRoot'] = false;

\$cfg['TempDir'] = '${PMA_DIR}/tmp';
\$cfg['DefaultLang'] = 'ko';
\$cfg['LoginCookieValidity'] = 3600;
\$cfg['VersionCheck'] = false;
PHP
  sudo chown root:apache "$PMA_DIR/config.inc.php"
  sudo chmod 640 "$PMA_DIR/config.inc.php"
fi

step "4. Nginx: /phpmyadmin 연결"
ALLOW_RULES=""
for ip in ${PMA_ALLOW_IPS:-}; do ALLOW_RULES+="        allow ${ip};"$'\n'; done
[[ -n "$ALLOW_RULES" ]] && ALLOW_RULES+="        deny all;"$'\n'

sudo mkdir -p "$NGINX_SNIPPET_DIR"
sudo tee "$NGINX_SNIPPET_DIR/phpmyadmin.conf" >/dev/null <<NGINX
# ProjectQ: setup-phpmyadmin.sh 가 생성 (projectq.conf 의 server 블록 안에 include 됨)
location = /phpmyadmin { return 301 /phpmyadmin/; }

location ^~ /phpmyadmin/ {
${ALLOW_RULES}        auth_basic "ProjectQ DB Admin";
        auth_basic_user_file ${HTPASSWD};

        root ${DATA};
        index index.php;
        client_max_body_size 64m;   # SQL 파일 가져오기용

        # 내부 폴더 직접 접근 차단
        location ~ ^/phpmyadmin/(libraries|templates|vendor|sql|tmp|setup)/ { deny all; }
        location ~ /\. { deny all; }

        location ~ \.php\$ {
            try_files \$uri =404;
            fastcgi_pass unix:${PHP_FPM_SOCK};
            fastcgi_index index.php;
            include fastcgi_params;
            fastcgi_param SCRIPT_FILENAME \$document_root\$fastcgi_script_name;
        }
}
NGINX
# projectq.conf 의 server 블록에 include 가 없으면 추가
if ! sudo grep -q "include ${NGINX_SNIPPET_DIR}/\*.conf;" "$NGINX_SITE"; then
  sudo sed -i "0,/index index.html;/s#index index.html;#index index.html;\n\n    include ${NGINX_SNIPPET_DIR}/*.conf;#" "$NGINX_SITE"
fi

# SELinux Enforcing 일 때만 라벨 지정
if command -v getenforce >/dev/null && [[ "$(getenforce)" == "Enforcing" ]]; then
  sudo dnf install -y policycoreutils-python-utils
  sudo semanage fcontext -a -t httpd_sys_content_t "$PMA_DIR(/.*)?" 2>/dev/null || true
  sudo semanage fcontext -a -t httpd_sys_rw_content_t "$PMA_DIR/tmp(/.*)?" 2>/dev/null || true
  sudo semanage fcontext -a -t httpd_sys_content_t "$HTPASSWD" 2>/dev/null || true
  sudo restorecon -R "$PMA_DIR" "$HTPASSWD"
fi

sudo nginx -t
sudo systemctl reload nginx

IP="$(curl -fsS -m 2 http://checkip.amazonaws.com 2>/dev/null || echo '<서버IP>')"
echo
echo "phpMyAdmin 설치 완료: http://${IP}/phpmyadmin/"
echo "  1) 브라우저 로그인 창: 웹 관리자 계정 (목록: bash $0 users)"
echo "  2) phpMyAdmin 로그인: MySQL 계정 (예: ② 에서 만든 DB 관리자 계정)"
