#!/usr/bin/env bash
# phpMyAdmin 설치 → http://<서버IP>/phpmyadmin  (Amazon Linux 2023, ② setup-server.sh 이후 실행)
#
#   bash setup-phpmyadmin.sh
#
# 접속하면 바로 phpMyAdmin 로그인 화면 → MySQL 계정으로 로그인 (② 에서 만든 DB 관리자 계정 등)
#   - root 로그인, 비밀번호 없는 계정 로그인은 막혀 있음
#   - 비밀번호 무차별 대입을 늦추기 위해 요청 속도 제한 적용
#
# 접속 IP 제한(권장): PMA_ALLOW_IPS="1.2.3.4 5.6.7.8" bash setup-phpmyadmin.sh
# 최신 버전으로 교체: PMA_UPGRADE=1 bash setup-phpmyadmin.sh
set -euo pipefail
trap 'echo "❌ 설치 실패 (줄 $LINENO): $BASH_COMMAND" >&2' ERR

DATA="${DATA:-/data}"
PMA_DIR="$DATA/phpmyadmin"
OLD_AUTH_DIR="$DATA/auth"   # 이전 버전의 웹 로그인(Basic 인증) 파일 — 이제 사용하지 않아 정리
NGINX_SNIPPET_DIR="/etc/nginx/projectq.d"
NGINX_SITE="/etc/nginx/conf.d/projectq.conf"
NGINX_RATE_LIMIT="/etc/nginx/conf.d/phpmyadmin-ratelimit.conf"
PHP_FPM_SOCK="/run/php-fpm/www.sock"
MYSQL_SOCKET="/var/lib/mysql/mysql.sock"
PMA_URL="https://www.phpmyadmin.net/downloads/phpMyAdmin-latest-all-languages.tar.gz"

step() { echo; echo "== $* =="; }

# ---------- 설치 ----------
if ! mountpoint -q "$DATA"; then
  echo "$DATA 가 마운트되어 있지 않습니다. 먼저 ①, ② 를 실행하세요." >&2
  exit 1
fi
[[ -f "$NGINX_SITE" ]] || { echo "$NGINX_SITE 가 없습니다. 먼저 ② setup-server.sh 를 실행하세요." >&2; exit 1; }

step "1. PHP 설치"
sudo dnf install -y php-fpm php-mysqlnd php-mbstring php-xml
# 있으면 좋은 확장 (저장소에 없으면 건너뜀)
sudo dnf install -y --setopt=strict=0 php-gd php-intl php-zip php-sodium || true
sudo systemctl enable php-fpm
sudo systemctl restart php-fpm
# (php-fpm 만 설치하면 php CLI 가 없을 수 있으므로 php-fpm 으로 버전 확인)
sudo php-fpm -v | head -1 || true

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

# 요청 속도 제한 영역 (http 블록에 들어가야 해서 conf.d 에 별도 파일)
sudo tee "$NGINX_RATE_LIMIT" >/dev/null <<'NGINX'
# ProjectQ: setup-phpmyadmin.sh 가 생성 — phpMyAdmin PHP 요청을 IP 당 초당 10회로 제한
limit_req_zone $binary_remote_addr zone=phpmyadmin:10m rate=10r/s;
NGINX

sudo mkdir -p "$NGINX_SNIPPET_DIR"
sudo tee "$NGINX_SNIPPET_DIR/phpmyadmin.conf" >/dev/null <<NGINX
# ProjectQ: setup-phpmyadmin.sh 가 생성 (projectq.conf 의 server 블록 안에 include 됨)
location = /phpmyadmin { return 301 /phpmyadmin/; }

location ^~ /phpmyadmin/ {
${ALLOW_RULES}        root ${DATA};
        index index.php;
        client_max_body_size 64m;   # SQL 파일 가져오기용

        # 내부 폴더 직접 접근 차단
        location ~ ^/phpmyadmin/(libraries|templates|vendor|sql|tmp|setup)/ { deny all; }
        location ~ /\. { deny all; }

        location ~ \.php\$ {
            limit_req zone=phpmyadmin burst=40 nodelay;
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
  sudo restorecon -R "$PMA_DIR"
fi

# 이전 버전에서 만든 웹 로그인 비밀번호 파일 정리
sudo rm -rf "$OLD_AUTH_DIR"

sudo nginx -t
sudo systemctl reload nginx

IP="$(curl -fsS -m 2 http://checkip.amazonaws.com 2>/dev/null || echo '<서버IP>')"
echo
echo "phpMyAdmin 설치 완료: http://${IP}/phpmyadmin/"
echo "  로그인: MySQL 계정 (예: ② 에서 만든 DB 관리자 계정). root 는 로그인 불가"
