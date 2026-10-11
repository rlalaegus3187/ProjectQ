#!/usr/bin/env bash
# (예전 이름) 채팅 웹소켓 Nginx 설정 — 이제 deploy.js 가 배포 때마다 apply-ports.sh 로 자동 처리합니다.
# 배포 없이 지금 바로 맞추고 싶을 때만:
#   bash /data/ProjectQ/deploy/setup-socketio.sh
# 한 서버에 사이트 여러 개: APP_DIR=/data/Site2 NGINX_SITE=/etc/nginx/conf.d/site2.conf NGINX_SNIPPET_DIR=/etc/nginx/site2.d bash ...
set -euo pipefail
APP_DIR="${APP_DIR:-$(cd "$(dirname "$0")/.." && pwd)}"
PORTS="$(cd "$APP_DIR/server" && node scripts/ports.js | tail -1)"
API_PORT="$(node -e "console.log(JSON.parse(process.argv[1]).apiPort)" "$PORTS")"
CHAT_PORT="$(node -e "console.log(JSON.parse(process.argv[1]).chatPort)" "$PORTS")"
APP_NAME="$(grep -E '^APP_NAME=' "$APP_DIR/server/.env" 2>/dev/null | cut -d= -f2 || true)"
APP_NAME="${APP_NAME:-projectq}" API_PORT="$API_PORT" CHAT_PORT="$CHAT_PORT" bash "$APP_DIR/deploy/apply-ports.sh"
