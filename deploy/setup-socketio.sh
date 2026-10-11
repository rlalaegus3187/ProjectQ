#!/usr/bin/env bash
# 채팅(Socket.IO) 웹소켓을 Nginx 에서 통과시키기 — 사이트마다 한 번만 실행 (② setup-server.sh 이후)
#
#   bash /data/ProjectQ/deploy/setup-socketio.sh
#
# 안 해도 채팅은 동작합니다 (기존 /api/ 프록시로 롱폴링). 하면 웹소켓으로 바뀌어 더 빠르고 서버 부담도 적음.
# 이 사이트의 API 포트(.env 의 PORT)를 읽어서 /etc/nginx/projectq.d/socketio.conf 를 만듭니다.
#   (setup-server.sh 가 만든 Nginx 사이트 설정이 이 폴더를 include 함)
#
# 한 서버에 사이트 여러 개: 사이트마다 자기 .env 와 자기 Nginx 추가 설정 폴더로
#   PROJECTQ_ENV=/data/config/site2.env NGINX_SNIPPET_DIR=/etc/nginx/site2.d bash setup-socketio.sh
set -euo pipefail
trap 'echo "❌ 설정 실패 (줄 $LINENO): $BASH_COMMAND" >&2' ERR

ENV_FILE="${PROJECTQ_ENV:-/data/config/projectq.env}"
NGINX_SNIPPET_DIR="${NGINX_SNIPPET_DIR:-/etc/nginx/projectq.d}"
SNIPPET="$NGINX_SNIPPET_DIR/socketio.conf"

[[ -f "$ENV_FILE" ]] || { echo "$ENV_FILE 가 없습니다. PROJECTQ_ENV=<.env 경로> 로 알려주세요." >&2; exit 1; }
[[ -d "$NGINX_SNIPPET_DIR" ]] || { echo "$NGINX_SNIPPET_DIR 가 없습니다. 먼저 ② setup-server.sh 를 실행하세요." >&2; exit 1; }
PORT="$(grep -E '^PORT=' "$ENV_FILE" | tail -1 | cut -d= -f2 | tr -d '"'"'"' ')"
PORT="${PORT:-3000}"
[[ "$PORT" =~ ^[0-9]+$ ]] || { echo "PORT 값이 숫자가 아닙니다: $PORT" >&2; exit 1; }

echo "== $SNIPPET 작성 (API 포트 $PORT) =="
sudo tee "$SNIPPET" >/dev/null <<NGINX
# 채팅 (Socket.IO) — 웹소켓 업그레이드 허용. deploy/setup-socketio.sh 가 만든 파일
location /api/socket.io/ {
    proxy_pass http://127.0.0.1:${PORT};
    proxy_http_version 1.1;
    proxy_set_header Upgrade \$http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
    proxy_read_timeout 1h;    # 오래 열려 있는 연결
    proxy_send_timeout 1h;
    proxy_buffering off;
}
NGINX

sudo nginx -t
sudo systemctl reload nginx 2>/dev/null || sudo nginx -s reload
echo "✔ 완료 — 채팅이 웹소켓으로 연결됩니다."
