#!/usr/bin/env bash
# ② EC2(Ubuntu 24.04) 기본 세팅 — repo 없이 단독 실행 가능, 여러 번 실행해도 안전(idempotent)
#
#   전제: ① mount-instance-store.sh 로 /data 가 마운트되어 있어야 함
#   사용: bash setup-server.sh
#
# 모든 앱 데이터는 /data (Instance Store) 에 저장합니다.
#   /data/mysql                 MySQL 데이터 디렉터리
#   /data/config/projectq.env   앱 설정(DB 비밀번호, 세션 키)
#   /data/www/projectq          Vue 빌드 결과물 (Nginx 가 서빙)
#   /data/logs                  API 로그 (PM2)
#   /data/ProjectQ              코드 (③ deploy.js 가 git clone)
set -euo pipefail

DATA="${DATA:-/data}"
MYSQL_DIR="$DATA/mysql"
ENV_FILE="$DATA/config/projectq.env"
WEB_ROOT="$DATA/www/projectq"
DB_NAME="projectq"
DB_USER="projectq"
MOUNT_SERVICE="projectq-data-mount.service"

step() { echo; echo "== $* =="; }

if ! mountpoint -q "$DATA"; then
  echo "$DATA 가 마운트되어 있지 않습니다. 먼저 ① mount-instance-store.sh 를 실행하세요." >&2
  exit 1
fi

step "1. 패키지 설치 (git, nginx, mysql, node 22, pm2)"
sudo apt-get update
sudo apt-get install -y git nginx mysql-server ca-certificates curl openssl
if ! command -v node >/dev/null || [[ "$(node -v)" != v22* ]]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi
command -v pm2 >/dev/null || sudo npm install -g pm2
echo "node $(node -v) / npm $(npm -v) / pm2 $(pm2 -v)"

step "2. /data 디렉터리 준비"
sudo mkdir -p "$DATA/config" "$DATA/www" "$DATA/logs"
sudo chown "$USER:$USER" "$DATA/config" "$DATA/www" "$DATA/logs"
chmod 700 "$DATA/config"

step "3. MySQL 데이터 디렉터리 → $MYSQL_DIR"
# AppArmor 가 /data/mysql 접근을 허용하도록 별칭 등록
if ! grep -q "$MYSQL_DIR" /etc/apparmor.d/tunables/alias 2>/dev/null; then
  echo "alias /var/lib/mysql/ -> $MYSQL_DIR/," | sudo tee -a /etc/apparmor.d/tunables/alias >/dev/null
  sudo systemctl reload apparmor 2>/dev/null || sudo systemctl restart apparmor 2>/dev/null || true
fi
sudo tee /etc/mysql/mysql.conf.d/zz-projectq.cnf >/dev/null <<CNF
[mysqld]
datadir = $MYSQL_DIR
CNF
if [[ ! -d "$MYSQL_DIR/mysql" ]]; then
  echo "$MYSQL_DIR 가 비어 있어 새로 초기화합니다."
  sudo systemctl stop mysql || true
  sudo mkdir -p "$MYSQL_DIR"
  sudo chown mysql:mysql "$MYSQL_DIR"
  sudo chmod 750 "$MYSQL_DIR"
  # root@localhost 는 비밀번호 없이 생성되지만 sudo mysql(소켓) 로만 접속 가능 — 외부 포트는 닫혀 있음
  sudo mysqld --initialize-insecure --user=mysql --datadir="$MYSQL_DIR"
fi
sudo systemctl enable mysql
sudo systemctl restart mysql
sudo mysql -N -e "SELECT CONCAT('MySQL ', VERSION(), ' datadir=', @@datadir)"

step "4. DB/계정 + $ENV_FILE"
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

step "5. Nginx"
sudo tee /etc/nginx/sites-available/projectq >/dev/null <<NGINX
server {
    listen 80;
    server_name _;   # 도메인이 생기면 example.com 으로 변경 후 certbot 실행

    root $WEB_ROOT;
    index index.html;

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
sudo ln -sf /etc/nginx/sites-available/projectq /etc/nginx/sites-enabled/projectq
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl enable nginx
sudo systemctl reload nginx || sudo systemctl start nginx

step "6. PM2 부팅 자동 시작 + /data 마운트 이후에 서비스가 뜨도록 순서 지정"
sudo env PATH="$PATH" pm2 startup systemd -u "$USER" --hp "$HOME" >/dev/null
for svc in mysql nginx "pm2-$USER"; do
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
echo "  node deploy.js --branch=<브랜치> --seed"
