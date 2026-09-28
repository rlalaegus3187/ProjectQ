# EC2(m6id.large) 배포 가이드

순서: **① Instance Store 마운트 → ② EC2 기본 세팅 → ③ git 에서 불러와 배포**

```
브라우저 ──80/443──▶ Nginx
                      ├─ /        → /data/www/projectq   (Vue 빌드 결과물)
                      └─ /api/*   → 127.0.0.1:3000       (Express, PM2)
                                        └─ MySQL 8 (datadir=/data/mysql)

/data  (m6id NVMe Instance Store, 약 118GB)  ← 모든 코드와 데이터
├─ ProjectQ/                 코드 (git clone)
├─ mysql/                    MySQL 데이터
├─ config/projectq.env       앱 설정 (DB 비밀번호, 세션 키)
├─ www/projectq/             프론트 빌드 결과물
├─ logs/                     API 로그
└─ deploy.js                 ③ 불러오기/업데이트 스크립트
```

> ⚠ **Instance Store 특성**: 재부팅(reboot)에는 유지되지만, **인스턴스 중지(stop)→시작(start) / 종료 / 호스트 장애 시 `/data` 전체(DB 포함)가 비워집니다.**
> - 서버를 끌 때는 stop 대신 **reboot** 를 쓰세요.
> - DB 는 주기적으로 백업(`mysqldump` → S3 등)해 두는 걸 강력히 권장합니다.
> - 비워졌을 때 복구 방법은 맨 아래 참고.

AWS 콘솔에서: AMI **Ubuntu 24.04**, 타입 **m6id.large**, 보안 그룹 인바운드 `22`(내 IP만) / `80` / `443`. (3000, 3306 은 열지 않음)

```bash
ssh -i my-key.pem ubuntu@<EC2-IP>

# 아래 명령들에서 공통으로 사용 (main 에 머지 후에는 BRANCH=main)
BRANCH=claude/spa-login-service-q4af80
RAW=https://raw.githubusercontent.com/rlalaegus3187/ProjectQ/$BRANCH/deploy
```

---

## ① Instance Store 마운트 (`/data`)

### 스크립트로 (권장)
```bash
curl -fsSLO $RAW/mount-instance-store.sh
sudo bash mount-instance-store.sh --install
```
- 모델명이 `Amazon EC2 NVMe Instance Storage` 인 디스크만 찾아서(EBS 루트 디스크는 건드리지 않음)
- 파일시스템이 없으면 ext4 로 포맷 → `/data` 에 마운트 → 소유자 `ubuntu`
- `--install`: 부팅 때마다 같은 작업을 하는 systemd 서비스(`projectq-data-mount`) 등록

### 직접 하는 방법 (스크립트가 하는 일과 같음)
```bash
lsblk -o NAME,SIZE,MODEL,MOUNTPOINT
# nvme0n1  8G      Amazon Elastic Block Store          ← 루트(EBS). 건드리지 않음
# nvme1n1  110.6G  Amazon EC2 NVMe Instance Storage    ← 이게 대상

sudo mkfs.ext4 -F -L projectq-data /dev/nvme1n1   # 포맷 (처음 한 번)
sudo mkdir -p /data
sudo mount -o defaults,noatime /dev/nvme1n1 /data
sudo chown ubuntu:ubuntu /data
df -h /data
```
> `/etc/fstab` 에 등록하지 않는 이유: stop/start 후엔 디스크가 새것(UUID 변경, 파일시스템 없음)이라 fstab 방식은 부팅이 멈출 수 있습니다. 그래서 `--install` 의 부팅 서비스가 "없으면 포맷 → 마운트" 를 대신합니다.

## ② EC2 기본 세팅

```bash
curl -fsSLO $RAW/setup-server.sh
bash setup-server.sh
```
하는 일 (다시 실행해도 안전):

| 단계 | 내용 |
|---|---|
| 1 | git, Nginx, MySQL 8, Node.js 22, PM2 설치 |
| 2 | `/data/config`, `/data/www`, `/data/logs` 생성 |
| 3 | MySQL 데이터 디렉터리를 **`/data/mysql`** 로 지정 (AppArmor 허용 포함), 비어 있으면 초기화 |
| 4 | `projectq` DB/계정 생성 (비밀번호 랜덤) → **`/data/config/projectq.env`** 작성 |
| 5 | Nginx 설정 (`root /data/www/projectq`, `/api` → 3000 프록시) |
| 6 | PM2 부팅 자동 시작, MySQL·Nginx·PM2 가 `/data` 마운트 **이후에** 시작되도록 순서 지정 |

## ③ git 에서 불러와 배포 (`deploy.js`)

```bash
curl -fsSL $RAW/deploy.js -o /data/deploy.js
node /data/deploy.js --branch=$BRANCH --seed
```

`deploy.js` 가 하는 일:

| 단계 | 내용 |
|---|---|
| 0 | `/data/ProjectQ` 가 없으면 `git clone` |
| 1 | `git fetch` + fast-forward 로 최신 코드 받기 (deploy.js 자체가 바뀌면 새 버전으로 재실행) |
| 2 | `/data/config/projectq.env` → `server/.env` 복사, `npm ci` |
| 3 | DB 마이그레이션 (`db/migrations/*.sql` 중 새 파일만) + `--seed` 면 샘플 계정 |
| 4 | Vue 빌드 → `/data/www/projectq` 교체 |
| 5 | `pm2 startOrReload` → `/api/health` 헬스체크 |

브라우저에서 `http://<EC2-IP>` → `demo@projectq.local` / `demo1234` 로 로그인.

### 이후 업데이트 (코드 push 후)
```bash
node /data/deploy.js
```
로컬 PC 에서 한 줄로: `ssh -i my-key.pem ubuntu@<EC2-IP> 'node /data/deploy.js'`

옵션: `--branch=main`(브랜치 변경), `--force`(서버에서 직접 수정한 파일 무시), `--skip-pull`, `--skip-client`

---

## HTTPS (도메인 연결 후)
```bash
sudo sed -i 's/server_name _;/server_name example.com;/' /etc/nginx/sites-available/projectq
sudo nginx -t && sudo systemctl reload nginx
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d example.com
sed -i 's/^COOKIE_SECURE=false/COOKIE_SECURE=true/' /data/config/projectq.env
node /data/deploy.js --skip-client
```

## DB 백업 (권장)
```bash
sudo mysqldump --single-transaction projectq | gzip > /data/backup-$(date +%F).sql.gz
# /data 는 stop/start 시 지워지므로, 백업 파일은 S3 등 외부로 옮겨두세요:
# aws s3 cp /data/backup-$(date +%F).sql.gz s3://<버킷>/projectq/
```

## stop → start 로 `/data` 가 비워졌을 때 복구
부팅 서비스가 빈 디스크를 이미 포맷·마운트해 두므로 ②, ③ 만 다시 하면 됩니다.
```bash
BRANCH=claude/spa-login-service-q4af80
RAW=https://raw.githubusercontent.com/rlalaegus3187/ProjectQ/$BRANCH/deploy
curl -fsSLO $RAW/setup-server.sh && bash setup-server.sh
curl -fsSL $RAW/deploy.js -o /data/deploy.js && node /data/deploy.js --branch=$BRANCH
# 백업이 있으면: gunzip -c backup.sql.gz | sudo mysql projectq
```

## 자주 쓰는 명령
```bash
pm2 status                              # API 상태
pm2 logs projectq-api                   # API 로그 (/data/logs 에도 저장)
sudo tail -f /var/log/nginx/error.log
sudo mysql projectq                     # DB 접속
```

| 증상 | 확인 |
|---|---|
| 접속 안 됨 | 보안 그룹 80 포트, `sudo systemctl status nginx` |
| 502 Bad Gateway | `pm2 logs projectq-api` (DB 접속 정보, `.env`) |
| 500/404 (첫 화면) | `/data/www/projectq` 존재 여부 → `node /data/deploy.js` |
| MySQL 안 뜸 | `df -h /data` 로 마운트 확인, `sudo journalctl -u mysql` |
| 로그인 후 바로 풀림 | http 인데 `COOKIE_SECURE=true` 인지 확인 |
