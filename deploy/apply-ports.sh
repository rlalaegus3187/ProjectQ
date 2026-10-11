#!/usr/bin/env bash
# 저장된 포트(API / 채팅)로 Nginx 연결 맞추기 — deploy.js 가 배포 때마다 자동으로 실행 (바뀐 게 없으면 아무것도 안 함)
#
#   직접 실행: sudo env APP_NAME=projectq API_PORT=3000 CHAT_PORT=3100 bash deploy/apply-ports.sh
#
# 하는 일
#   1) /etc/nginx/conf.d/<APP_NAME>-ports.conf   upstream <이름>_api (API 포트) / <이름>_chat (채팅 포트) — 포트 번호는 여기 한 곳에만
#   2) 사이트 설정(NGINX_SITE)의 /api/ 가 숫자 대신 <이름>_api 를 가리키게 (처음 한 번만 바뀜, 원본은 .bak-날짜 로 백업)
#   3) NGINX_SNIPPET_DIR/socketio.conf             /api/socket.io/ → <이름>_chat (웹소켓 허용)
#   nginx -t 가 실패하면 모두 원래대로 되돌림
#
# 한 서버에 사이트 여러 개: 사이트마다 APP_NAME · NGINX_SITE · NGINX_SNIPPET_DIR 를 다르게
set -euo pipefail

APP_NAME="${APP_NAME:-projectq}"
API_PORT="${API_PORT:?API_PORT 가 필요합니다}"
CHAT_PORT="${CHAT_PORT:-$API_PORT}"
NGINX_SITE="${NGINX_SITE:-/etc/nginx/conf.d/projectq.conf}"
NGINX_SNIPPET_DIR="${NGINX_SNIPPET_DIR:-/etc/nginx/projectq.d}"
UPSTREAM_FILE="${NGINX_UPSTREAM_FILE:-/etc/nginx/conf.d/${APP_NAME}-ports.conf}"
SNIPPET="$NGINX_SNIPPET_DIR/socketio.conf"
UP="$(echo "$APP_NAME" | tr -c 'a-zA-Z0-9_\n' '_')"   # upstream 이름 (영문·숫자·_)

if [[ $EUID -ne 0 ]]; then exec sudo -n env APP_NAME="$APP_NAME" API_PORT="$API_PORT" CHAT_PORT="$CHAT_PORT" \
  NGINX_SITE="$NGINX_SITE" NGINX_SNIPPET_DIR="$NGINX_SNIPPET_DIR" NGINX_UPSTREAM_FILE="$UPSTREAM_FILE" bash "$0"; fi
for p in "$API_PORT" "$CHAT_PORT"; do [[ "$p" =~ ^[0-9]+$ ]] && (( p >= 1024 && p <= 65535 )) || { echo "잘못된 포트: $p" >&2; exit 1; }; done
[[ -f "$NGINX_SITE" ]] || { echo "Nginx 사이트 설정이 없습니다: $NGINX_SITE (NGINX_SITE=<경로> 로 알려주세요)" >&2; exit 1; }
mkdir -p "$NGINX_SNIPPET_DIR"

TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
cat > "$TMP/upstream" <<NGINX
# $APP_NAME 서버 포트 — deploy/apply-ports.sh 가 만든 파일 (server/.env 의 PORT / CHAT_PORT, 배포 때 갱신)
upstream ${UP}_api  { server 127.0.0.1:${API_PORT}; }
upstream ${UP}_chat { server 127.0.0.1:${CHAT_PORT}; }
NGINX
cat > "$TMP/snippet" <<NGINX
# 채팅 (Socket.IO) — 웹소켓 허용. deploy/apply-ports.sh 가 만든 파일
location /api/socket.io/ {
    proxy_pass http://${UP}_chat;
    proxy_http_version 1.1;
    proxy_set_header Upgrade \$http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
    proxy_read_timeout 1h;
    proxy_send_timeout 1h;
    proxy_buffering off;
}
NGINX
# 사이트 설정: proxy_pass http://127.0.0.1:<숫자>; (또는 예전 upstream 이름) → http://<이름>_api;
sed -E "s#proxy_pass http://(127\\.0\\.0\\.1:[0-9]+|[A-Za-z0-9_]+_api);#proxy_pass http://${UP}_api;#" "$NGINX_SITE" > "$TMP/site"

same() { [[ -f "$2" ]] && cmp -s "$1" "$2"; }
if same "$TMP/upstream" "$UPSTREAM_FILE" && same "$TMP/snippet" "$SNIPPET" && same "$TMP/site" "$NGINX_SITE"; then
  echo "Nginx 포트 설정 변경 없음 (API $API_PORT, 채팅 $CHAT_PORT)"
  exit 0
fi

# 바꾸기 (실패하면 되돌릴 수 있게 백업)
STAMP="$(date +%Y%m%d-%H%M%S)"
for f in "$UPSTREAM_FILE" "$SNIPPET" "$NGINX_SITE"; do [[ -f "$f" ]] && cp -p "$f" "$TMP/$(basename "$f").orig"; done
restore() {
  for f in "$UPSTREAM_FILE" "$SNIPPET" "$NGINX_SITE"; do
    if [[ -f "$TMP/$(basename "$f").orig" ]]; then cp -p "$TMP/$(basename "$f").orig" "$f"; else rm -f "$f"; fi
  done
}
if ! same "$TMP/site" "$NGINX_SITE"; then cp -p "$NGINX_SITE" "$NGINX_SITE.bak-$STAMP"; cat "$TMP/site" > "$NGINX_SITE"; fi
cat "$TMP/upstream" > "$UPSTREAM_FILE"
cat "$TMP/snippet" > "$SNIPPET"

if ! nginx -t 2>"$TMP/nginx-test"; then
  cat "$TMP/nginx-test" >&2
  restore
  echo "❌ Nginx 설정 검사 실패 — 원래대로 되돌렸습니다." >&2
  exit 1
fi
systemctl reload nginx 2>/dev/null || nginx -s reload
echo "✔ Nginx 포트 적용: API → 127.0.0.1:$API_PORT, 채팅 → 127.0.0.1:$CHAT_PORT"
