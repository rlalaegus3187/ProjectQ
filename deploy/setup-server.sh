#!/usr/bin/env bash
# ② EC2(Amazon Linux 2023) 기본 세팅 — repo 없이 단독 실행 가능, 여러 번 실행해도 안전(idempotent)
#
#   전제: ① mount-instance-store.sh 로 /data 가 마운트되어 있어야 함
#   사용: bash setup-server.sh        (ec2-user 로 실행, 내부에서 필요한 곳만 sudo)
#
# 모든 앱 데이터는 /data (Instance Store) 에 저장합니다.
#   /data/mysql                 MySQL 데이터 (테이블, 인덱스, redo/undo, binlog)
#   /data/mysql-tmp             MySQL 임시파일
#   /data/config/projectq.env   앱 설정(DB 비밀번호, 세션 키)
#   /data/www/projectq          Vue 빌드 결과물 (Nginx 가 서빙)
#   /data/logs                  API 로그 (PM2), logs/mysql/error.log (MySQL 에러 로그)
#   /data/ProjectQ              코드 (③ deploy.js 가 git clone)
set -euo pipefail

DATA="${DATA:-/data}"
MYSQL_DIR="$DATA/mysql"
MYSQL_TMP="$DATA/mysql-tmp"
MYSQL_LOG_DIR="$DATA/logs/mysql"
ENV_FILE="$DATA/config/projectq.env"
WEB_ROOT="$DATA/www/projectq"
DB_NAME="projectq"
DB_USER="projectq"
MOUNT_SERVICE="projectq-data-mount.service"
# 소켓은 패키지 기본 위치 유지 (mysql 클라이언트 기본값과 동일)
MYSQL_SOCKET="/var/lib/mysql/mysql.sock"

step() { echo; echo "== $* =="; }

if ! grep -q 'Amazon Linux' /etc/os-release 2>/dev/null; then
  echo "이 스크립트는 Amazon Linux 2023 용입니다." >&2
  exit 1
fi
if ! mountpoint -q "$DATA"; then
  echo "$DATA 가 마운트되어 있지 않습니다. 먼저 ① mount-instance-store.sh 를 실행하세요." >&2
  exit 1
fi

# DB 로그인용 관리자 계정 (DBeaver/Workbench 등에서 사용).
# 설치가 오래 걸리므로 처음에 입력받음. 이미 만들었으면(표시 파일 존재) 건너뜀.
# 비대화식 실행: DB_ADMIN_USER=admin DB_ADMIN_PASSWORD='...' bash setup-server.sh
DB_ADMIN_MARKER="$DATA/config/.db-admin-user"
DB_ADMIN_USER="${DB_ADMIN_USER:-}"
DB_ADMIN_PASSWORD="${DB_ADMIN_PASSWORD:-}"
if [[ -f "$DB_ADMIN_MARKER" ]]; then
  echo "DB 관리자 계정이 이미 있습니다: $(cat "$DB_ADMIN_MARKER") (새로 만들려면 $DB_ADMIN_MARKER 삭제 후 재실행)"
elif [[ -z "$DB_ADMIN_PASSWORD" ]]; then
  echo "== DB 로그인용 관리자 계정 설정 =="
  read -rp "  아이디 [admin]: " DB_ADMIN_USER
  while true; do
    read -rsp "  비밀번호 (8자 이상): " DB_ADMIN_PASSWORD; echo
    read -rsp "  비밀번호 확인: " confirm; echo
    [[ "$DB_ADMIN_PASSWORD" == "$confirm" ]] || { echo "  비밀번호가 일치하지 않습니다."; continue; }
    [[ ${#DB_ADMIN_PASSWORD} -ge 8 ]] || { echo "  8자 이상 입력하세요."; continue; }
    break
  done
fi
DB_ADMIN_USER="${DB_ADMIN_USER:-admin}"
if [[ ! "$DB_ADMIN_USER" =~ ^[A-Za-z0-9_]{1,32}$ ]]; then
  echo "아이디는 영문/숫자/_ 로 32자 이내여야 합니다: $DB_ADMIN_USER" >&2
  exit 1
fi
if [[ "$DB_ADMIN_USER" == "root" || "$DB_ADMIN_USER" == "$DB_USER" ]]; then
  echo "아이디로 root, $DB_USER 는 쓸 수 없습니다." >&2
  exit 1
fi

# SQL 문자열 리터럴용 이스케이프 (\ → \\, ' → '')
sql_quote() { local s="${1//\\/\\\\}"; printf "'%s'" "${s//\'/\'\'}"; }

step "1. 패키지 설치 (git, nginx, MySQL 8.4, Node.js 22, PM2)"
sudo dnf install -y git nginx openssl

# MySQL 공식 저장소 (Amazon Linux 2023 은 RHEL9/el9 계열 패키지 사용)
# 공식 release RPM 으로 등록하고, 실패하면 저장소 설정 파일을 직접 작성
if ! rpm -q mysql84-community-release >/dev/null 2>&1 && [[ ! -f /etc/yum.repos.d/mysql84-community.repo ]]; then
  sudo dnf install -y https://dev.mysql.com/get/mysql84-community-release-el9-1.noarch.rpm \
  || sudo tee /etc/yum.repos.d/mysql84-community.repo >/dev/null <<'REPO'
[mysql84-community]
name=MySQL 8.4 LTS Community Server
baseurl=https://repo.mysql.com/yum/mysql-8.4-community/el/9/$basearch/
enabled=1
gpgcheck=1
gpgkey=https://repo.mysql.com/RPM-GPG-KEY-mysql-2023
REPO
fi
sudo dnf install -y mysql-community-server

if ! command -v node >/dev/null || [[ "$(node -v)" != v22* ]]; then
  curl -fsSL https://rpm.nodesource.com/setup_22.x | sudo bash -
  sudo dnf install -y nodejs
fi
command -v pm2 >/dev/null || sudo npm install -g pm2
echo "node $(node -v) / npm $(npm -v) / pm2 $(pm2 -v)"

step "2. /data 디렉터리 준비"
sudo mkdir -p "$DATA/config" "$DATA/www" "$DATA/logs"
sudo chown "$USER:$USER" "$DATA/config" "$DATA/www" "$DATA/logs"
chmod 700 "$DATA/config"
chmod 755 "$DATA/www" "$DATA/logs"

step "3. MySQL 저장 위치 → $DATA (데이터·임시파일·에러로그)"
sudo mkdir -p "$MYSQL_DIR" "$MYSQL_TMP" "$MYSQL_LOG_DIR"
sudo chown mysql:mysql "$MYSQL_DIR" "$MYSQL_TMP" "$MYSQL_LOG_DIR"
sudo chmod 750 "$MYSQL_DIR" "$MYSQL_TMP" "$MYSQL_LOG_DIR"

# /etc/my.cnf 를 통째로 관리 (원본은 한 번만 백업)
[[ -f /etc/my.cnf.orig ]] || sudo cp /etc/my.cnf /etc/my.cnf.orig
sudo mkdir -p /etc/my.cnf.d
sudo tee /etc/my.cnf >/dev/null <<CNF
# ProjectQ: setup-server.sh 가 관리하는 파일 (원본: /etc/my.cnf.orig)
[mysqld]
datadir   = $MYSQL_DIR
tmpdir    = $MYSQL_TMP
log-error = $MYSQL_LOG_DIR/error.log
socket    = $MYSQL_SOCKET
pid-file  = /var/run/mysqld/mysqld.pid
character-set-server = utf8mb4
collation-server     = utf8mb4_unicode_ci

[client]
socket = $MYSQL_SOCKET
default-character-set = utf8mb4

!includedir /etc/my.cnf.d
CNF

if [[ ! -d "$MYSQL_DIR/mysql" ]]; then
  echo "$MYSQL_DIR 가 비어 있어 새로 초기화합니다."
  sudo systemctl stop mysqld 2>/dev/null || true
  sudo mysqld --initialize-insecure --user=mysql --datadir="$MYSQL_DIR"
  sudo systemctl start mysqld
  # --initialize-insecure 는 root 를 비밀번호 없이 만들므로, `sudo mysql` 로만 접속되게 변경
  sudo mysql -e "SELECT 1 FROM information_schema.plugins WHERE plugin_name='auth_socket'" | grep -q 1 \
    || sudo mysql -e "INSTALL PLUGIN auth_socket SONAME 'auth_socket.so';"
  sudo mysql -e "ALTER USER 'root'@'localhost' IDENTIFIED WITH auth_socket;"
fi
sudo systemctl enable mysqld
sudo systemctl restart mysqld
sudo mysql -N -e "SELECT CONCAT('MySQL ', VERSION(), ' / datadir=', @@datadir, ' / tmpdir=', @@tmpdir, ' / log_error=', @@log_error)"

step "4. DB/앱 계정 + $ENV_FILE + DB 관리자 계정"
if [[ -f "$ENV_FILE" ]]; then
  echo "$ENV_FILE 가 이미 있어 건너뜁니다."
else
  DB_PASSWORD="$(openssl rand -hex 24)"
  SESSION_SECRET="$(openssl rand -hex 48)"
  sudo mysql <<SQL
CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASSWORD}';
CREATE USER IF NOT EXISTS '${DB_USER}'@'127.0.0.1' IDENTIFIED BY '${DB_PASSWORD}';
ALTER USER '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASSWORD}';
ALTER USER '${DB_USER}'@'127.0.0.1' IDENTIFIED BY '${DB_PASSWORD}';
GRANT ALL PRIVILEGES ON \`${DB_NAME}\`.* TO '${DB_USER}'@'localhost';
GRANT ALL PRIVILEGES ON \`${DB_NAME}\`.* TO '${DB_USER}'@'127.0.0.1';
FLUSH PRIVILEGES;
SQL
  (umask 077 && cat > "$ENV_FILE" <<ENV
NODE_ENV=production
PORT=3000
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=${DB_USER}
DB_PASSWORD=${DB_PASSWORD}
DB_NAME=${DB_NAME}
SESSION_SECRET=${SESSION_SECRET}
# HTTPS(certbot) 적용 후 true 로 변경하고 deploy.js 다시 실행
COOKIE_SECURE=false
ENV
  )
  echo "$ENV_FILE 생성 완료 (DB 비밀번호/세션 키 자동 생성)"
fi

if [[ ! -f "$DB_ADMIN_MARKER" ]]; then
  # 비밀번호가 ps 에 보이지 않도록 -e 대신 stdin 으로 전달
  ADMIN_PW_SQL="$(sql_quote "$DB_ADMIN_PASSWORD")"
  sudo mysql <<SQL
CREATE USER IF NOT EXISTS '${DB_ADMIN_USER}'@'localhost' IDENTIFIED BY ${ADMIN_PW_SQL};
CREATE USER IF NOT EXISTS '${DB_ADMIN_USER}'@'127.0.0.1' IDENTIFIED BY ${ADMIN_PW_SQL};
ALTER USER '${DB_ADMIN_USER}'@'localhost' IDENTIFIED BY ${ADMIN_PW_SQL};
ALTER USER '${DB_ADMIN_USER}'@'127.0.0.1' IDENTIFIED BY ${ADMIN_PW_SQL};
GRANT ALL PRIVILEGES ON *.* TO '${DB_ADMIN_USER}'@'localhost' WITH GRANT OPTION;
GRANT ALL PRIVILEGES ON *.* TO '${DB_ADMIN_USER}'@'127.0.0.1' WITH GRANT OPTION;
SQL
  echo "$DB_ADMIN_USER" > "$DB_ADMIN_MARKER"
  unset DB_ADMIN_PASSWORD ADMIN_PW_SQL
  echo "DB 관리자 계정 생성 완료: $DB_ADMIN_USER (접속: mysql -u $DB_ADMIN_USER -p)"
fi

step "5. Nginx"
# Amazon Linux 기본 nginx.conf 에는 80 포트 기본 server 블록이 있어서, 깔끔한 설정으로 교체 (원본 백업)
[[ -f /etc/nginx/nginx.conf.orig ]] || sudo cp /etc/nginx/nginx.conf /etc/nginx/nginx.conf.orig
sudo tee /etc/nginx/nginx.conf >/dev/null <<'NGINX'
# ProjectQ: setup-server.sh 가 관리하는 파일 (원본: /etc/nginx/nginx.conf.orig)
user nginx;
worker_processes auto;
error_log /var/log/nginx/error.log notice;
pid /run/nginx.pid;
include /usr/share/nginx/modules/*.conf;

events { worker_connections 1024; }

http {
    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" "$http_user_agent"';
    access_log /var/log/nginx/access.log main;
    sendfile on;
    tcp_nopush on;
    keepalive_timeout 65;
    types_hash_max_size 4096;
    server_tokens off;
    include /etc/nginx/mime.types;
    default_type application/octet-stream;
    include /etc/nginx/conf.d/*.conf;
}
NGINX
sudo mkdir -p /etc/nginx/projectq.d
sudo tee /etc/nginx/conf.d/projectq.conf >/dev/null <<NGINX
server {
    listen 80 default_server;
    server_name _;   # 도메인이 생기면 example.com 으로 변경 후 certbot 실행

    root $WEB_ROOT;
    index index.html;

    # 추가 기능(phpMyAdmin 등)은 setup-phpmyadmin.sh 가 이 폴더에 설정을 넣음
    include /etc/nginx/projectq.d/*.conf;

    # 빌드 파일(해시 포함 파일명)은 오래 캐시
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        try_files \$uri =404;
    }

    # Vue Router history 모드: 없는 경로는 index.html 로
    location / {
        add_header Cache-Control "no-cache";
        try_files \$uri \$uri/ /index.html;
    }

    # API → Express (PM2, 127.0.0.1:3000)
    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    client_max_body_size 1m;
    gzip on;
    gzip_types text/css application/javascript application/json image/svg+xml;
}
NGINX
sudo nginx -t
sudo systemctl enable nginx
sudo systemctl restart nginx

step "6. SELinux (Enforcing 일 때만)"
if command -v getenforce >/dev/null && [[ "$(getenforce)" == "Enforcing" ]]; then
  # nginx → 3000 포트 프록시 허용, /data 경로에 알맞은 보안 라벨 지정
  sudo dnf install -y policycoreutils-python-utils
  sudo setsebool -P httpd_can_network_connect 1
  sudo semanage fcontext -a -t httpd_sys_content_t "$DATA/www(/.*)?" 2>/dev/null || true
  sudo semanage fcontext -a -t mysqld_db_t "$MYSQL_DIR(/.*)?" 2>/dev/null || true
  sudo semanage fcontext -a -t mysqld_tmp_t "$MYSQL_TMP(/.*)?" 2>/dev/null || true
  sudo semanage fcontext -a -t mysqld_log_t "$MYSQL_LOG_DIR(/.*)?" 2>/dev/null || true
  sudo restorecon -R "$DATA/www" "$MYSQL_DIR" "$MYSQL_TMP" "$MYSQL_LOG_DIR"
  sudo systemctl restart mysqld nginx
  echo "SELinux 설정 완료"
else
  echo "SELinux 가 Enforcing 이 아니므로 건너뜁니다 ($(getenforce 2>/dev/null || echo 없음))"
fi

step "7. PM2 부팅 자동 시작 + /data 마운트 이후에 서비스가 뜨도록 순서 지정"
sudo env PATH="$PATH" pm2 startup systemd -u "$USER" --hp "$HOME" >/dev/null
for svc in mysqld nginx "pm2-$USER"; do
  sudo mkdir -p "/etc/systemd/system/$svc.service.d"
  sudo tee "/etc/systemd/system/$svc.service.d/projectq-data.conf" >/dev/null <<UNIT
[Unit]
Wants=$MOUNT_SERVICE
After=$MOUNT_SERVICE
UNIT
done
sudo systemctl daemon-reload
systemctl is-enabled "$MOUNT_SERVICE" >/dev/null 2>&1 \
  || echo "⚠ $MOUNT_SERVICE 가 등록되어 있지 않습니다: sudo bash mount-instance-store.sh --install"

echo
echo "② 기본 세팅 완료. 다음 단계 ③ (git 에서 불러와 배포):"
echo "  curl -fsSL \$RAW/deploy.js -o /data/deploy.js && node /data/deploy.js --branch=\$BRANCH --seed"
