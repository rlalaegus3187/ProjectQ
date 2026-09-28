#!/usr/bin/env bash
# m6id 계열 인스턴스의 로컬 NVMe(Instance Store)를 /data 에 마운트합니다.
#
#   sudo bash deploy/mount-instance-store.sh            # 지금 마운트
#   sudo bash deploy/mount-instance-store.sh --install  # 마운트 + 부팅 시 자동 마운트 등록
#
# ⚠ Instance Store 는 "재부팅(reboot)"에는 데이터가 유지되지만,
#   인스턴스 "중지(stop)/시작(start)", 종료, 하드웨어 장애 시 디스크가 초기화됩니다.
#   그래서 fstab 대신 부팅 때마다 이 스크립트를 실행해서 "파일시스템이 없으면 포맷 → 마운트" 합니다.
set -euo pipefail

MOUNT_POINT="${MOUNT_POINT:-/data}"
OWNER="${OWNER:-ubuntu}"
SERVICE_NAME="projectq-data-mount"

if [[ $EUID -ne 0 ]]; then
  echo "root 권한이 필요합니다: sudo bash $0 $*" >&2
  exit 1
fi

# 모델명이 "Amazon EC2 NVMe Instance Storage" 인 디스크만 대상 (EBS 루트 디스크는 절대 건드리지 않음)
DEVICE="$(lsblk -dpno NAME,MODEL | awk '/Instance Storage/ {print $1; exit}')"
if [[ -z "$DEVICE" ]]; then
  echo "Instance Store 디스크를 찾지 못했습니다. (lsblk 로 확인하세요)" >&2
  exit 1
fi

if mountpoint -q "$MOUNT_POINT"; then
  echo "[mount] $MOUNT_POINT 는 이미 마운트되어 있습니다: $(findmnt -no SOURCE "$MOUNT_POINT")"
else
  if ! blkid "$DEVICE" >/dev/null 2>&1; then
    echo "[mount] $DEVICE 에 파일시스템이 없어 ext4 로 포맷합니다."
    mkfs.ext4 -F -L projectq-data "$DEVICE"
  fi
  mkdir -p "$MOUNT_POINT"
  mount -o defaults,noatime "$DEVICE" "$MOUNT_POINT"
  echo "[mount] $DEVICE → $MOUNT_POINT 마운트 완료"
fi

chown "$OWNER:$OWNER" "$MOUNT_POINT"
chmod 755 "$MOUNT_POINT"

if [[ "${1:-}" == "--install" ]]; then
  SCRIPT_TARGET="/usr/local/sbin/${SERVICE_NAME}.sh"
  install -m 755 "$(readlink -f "$0")" "$SCRIPT_TARGET"
  cat > "/etc/systemd/system/${SERVICE_NAME}.service" <<UNIT
[Unit]
Description=Format (if blank) and mount EC2 instance store at ${MOUNT_POINT}
After=local-fs.target
Before=nginx.service

[Service]
Type=oneshot
Environment=MOUNT_POINT=${MOUNT_POINT}
Environment=OWNER=${OWNER}
ExecStart=${SCRIPT_TARGET}
RemainAfterExit=yes

[Install]
WantedBy=multi-user.target
UNIT
  systemctl daemon-reload
  systemctl enable "${SERVICE_NAME}.service"
  echo "[mount] 부팅 시 자동 마운트 등록 완료 (${SERVICE_NAME}.service)"
fi

df -h "$MOUNT_POINT"
echo "① 마운트 완료. 다음 단계 ②: bash setup-server.sh"
