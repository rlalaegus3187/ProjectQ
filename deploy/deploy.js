#!/usr/bin/env node
// ③ ProjectQ 불러오기 + 전체 업데이트 스크립트
//
// 이 파일 하나만 서버에 받아서 실행해도 됩니다 (repo 가 없으면 /data/ProjectQ 로 git clone).
//   node /data/deploy.js --branch=main --seed    # 최초: clone → 설치 → DB → 빌드 → 실행 (+샘플 데이터)
//   node /data/deploy.js                          # 이후: git 최신 코드 받아서 전체 업데이트
//   node /data/ProjectQ/deploy/deploy.js          # (repo 안의 파일로 실행해도 동일)
//
// 옵션
//   --branch=<이름>   받아올 브랜치 (기본: 현재 체크아웃된 브랜치, 최초 clone 시에는 main)
//   --seed            샘플 계정/게시글 생성 (아이디 demo / 비밀번호 demo1234)
//   --force           서버에서 직접 수정한 파일이 있어도 버리고 git 기준으로 맞춤
//   --skip-pull       git pull 없이 현재 코드로만 빌드/재시작
//   --skip-client     프론트(Vue) 빌드 생략
//
// 환경변수
//   REPO_URL       git 주소 (기본: https://github.com/rlalaegus3187/ProjectQ.git)
//   APP_DIR        코드 위치 (기본: /data/ProjectQ)
//   PROJECTQ_ENV   서버 .env 원본 (기본: /data/config/projectq.env) → 매 배포 때 server/.env 로 복사
//   WEB_ROOT       Nginx 가 서빙하는 경로 (기본: /data/www/projectq)

const { execFileSync, spawnSync } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const REPO_URL = process.env.REPO_URL || 'https://github.com/rlalaegus3187/ProjectQ.git';
const APP_DIR = process.env.APP_DIR || '/data/ProjectQ';
const ROOT = path.resolve(__dirname, '..');
const IN_REPO = fs.existsSync(path.join(ROOT, '.git')) && fs.existsSync(path.join(ROOT, 'server', 'package.json'));
const SERVER_DIR = path.join(ROOT, 'server');
const CLIENT_DIR = path.join(ROOT, 'client');
const SHARED_ENV = process.env.PROJECTQ_ENV || '/data/config/projectq.env';
const WEB_ROOT = process.env.WEB_ROOT || '/data/www/projectq';
const LOCK_FILE = path.join(os.tmpdir(), 'projectq-deploy.lock');

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const option = (name) => args.find((a) => a.startsWith(`--${name}=`))?.split('=')[1];

function log(step, message) {
  console.log(`\x1b[36m[deploy]\x1b[0m ${step} ${message}`);
}

function run(cmd, cmdArgs, cwd = ROOT) {
  console.log(`  $ ${cmd} ${cmdArgs.join(' ')}`);
  const result = spawnSync(cmd, cmdArgs, { cwd, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`명령 실패 (exit ${result.status}): ${cmd} ${cmdArgs.join(' ')}`);
}

function capture(cmd, cmdArgs, cwd = ROOT) {
  return execFileSync(cmd, cmdArgs, { cwd, encoding: 'utf8' }).trim();
}

function fileHash(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

// 동시에 두 번 배포되지 않도록 잠금
function acquireLock() {
  try {
    fs.writeFileSync(LOCK_FILE, String(process.pid), { flag: 'wx' });
  } catch {
    const pid = Number(fs.readFileSync(LOCK_FILE, 'utf8'));
    let alive = false;
    try { process.kill(pid, 0); alive = true; } catch {}
    if (alive) throw new Error(`이미 배포가 진행 중입니다 (pid ${pid})`);
    fs.writeFileSync(LOCK_FILE, String(process.pid));
  }
  process.on('exit', () => {
    try {
      if (fs.readFileSync(LOCK_FILE, 'utf8') === String(process.pid)) fs.unlinkSync(LOCK_FILE);
    } catch {}
  });
}

// 1. git 에서 최신 코드 가져오기
function pull() {
  const branch = option('branch') || capture('git', ['rev-parse', '--abbrev-ref', 'HEAD']);
  const dirty = capture('git', ['status', '--porcelain', '--untracked-files=no']);
  if (dirty && !flag('force')) {
    throw new Error(`서버에서 수정된 파일이 있습니다. 버리려면 --force 를 붙이세요:\n${dirty}`);
  }

  const before = capture('git', ['rev-parse', 'HEAD']);
  run('git', ['fetch', '--prune', 'origin', branch]);
  if (capture('git', ['rev-parse', '--abbrev-ref', 'HEAD']) !== branch) {
    run('git', ['checkout', branch]);
  }
  if (flag('force')) {
    run('git', ['reset', '--hard', `origin/${branch}`]);
  } else {
    run('git', ['merge', '--ff-only', `origin/${branch}`]);
  }
  const after = capture('git', ['rev-parse', 'HEAD']);
  log('1/5', before === after
    ? `변경 없음 (${branch} @ ${after.slice(0, 7)})`
    : `${before.slice(0, 7)} → ${after.slice(0, 7)} (${branch})`);
}

// 2. 서버 .env 준비 + 의존성 설치
function setupServer() {
  const envPath = path.join(SERVER_DIR, '.env');
  if (fs.existsSync(SHARED_ENV)) {
    fs.copyFileSync(SHARED_ENV, envPath);
    fs.chmodSync(envPath, 0o600);
    log('2/5', `${SHARED_ENV} → server/.env 복사`);
  } else if (!fs.existsSync(envPath)) {
    throw new Error(`${SHARED_ENV} 도 server/.env 도 없습니다. ② setup-server.sh 를 먼저 실행하세요.`);
  }
  run('npm', ['ci', '--omit=dev', '--no-audit', '--no-fund'], SERVER_DIR);
}

// 3. DB 마이그레이션 (+ 샘플 데이터)
function migrate() {
  log('3/5', 'DB 마이그레이션');
  run('node', ['scripts/migrate.js'], SERVER_DIR);
  if (flag('seed')) run('node', ['scripts/seed.js'], SERVER_DIR);
}

// 4. Vue 빌드 → WEB_ROOT 로 교체 (새 폴더에 복사 후 이름 바꾸기 → 중간 상태가 서빙되지 않음)
function buildClient() {
  if (flag('skip-client')) return log('4/5', '프론트 빌드 생략');
  log('4/5', 'Vue 빌드');
  run('npm', ['ci', '--no-audit', '--no-fund'], CLIENT_DIR);
  run('npm', ['run', 'build'], CLIENT_DIR);

  const dist = path.join(CLIENT_DIR, 'dist');
  const next = `${WEB_ROOT}.next`;
  const prev = `${WEB_ROOT}.prev`;
  fs.mkdirSync(path.dirname(WEB_ROOT), { recursive: true });
  fs.rmSync(next, { recursive: true, force: true });
  fs.rmSync(prev, { recursive: true, force: true });
  fs.cpSync(dist, next, { recursive: true });
  if (fs.existsSync(WEB_ROOT)) fs.renameSync(WEB_ROOT, prev);
  fs.renameSync(next, WEB_ROOT);
  fs.rmSync(prev, { recursive: true, force: true });
  log('4/5', `${WEB_ROOT} 교체 완료`);
}

// 5. API 재시작 + 헬스체크
async function restartServer() {
  log('5/5', 'API 재시작 (PM2)');
  run('pm2', ['startOrReload', path.join(__dirname, 'ecosystem.config.cjs'), '--update-env']);
  run('pm2', ['save']);

  const envText = fs.readFileSync(path.join(SERVER_DIR, '.env'), 'utf8');
  const port = envText.match(/^PORT=(\d+)/m)?.[1] || '3000';
  const url = `http://127.0.0.1:${port}/api/health`;
  for (let i = 0; i < 15; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    try {
      const res = await fetch(url);
      if (res.ok) return log('5/5', `헬스체크 통과 (${url})`);
    } catch {}
  }
  throw new Error(`헬스체크 실패: ${url} — pm2 logs projectq-api 로 확인하세요`);
}

// 단독 실행(예: /data/deploy.js): repo 가 없으면 clone 한 뒤, repo 안의 deploy.js 에 이어서 맡김
function bootstrap() {
  let justCloned = false;
  if (!fs.existsSync(path.join(APP_DIR, '.git'))) {
    const branch = option('branch') || 'main';
    log('0/5', `${REPO_URL} (${branch}) → ${APP_DIR} clone`);
    fs.mkdirSync(path.dirname(APP_DIR), { recursive: true });
    run('git', ['clone', '--branch', branch, REPO_URL, APP_DIR], path.dirname(APP_DIR));
    justCloned = true;
  }
  const next = [path.join(APP_DIR, 'deploy', 'deploy.js'), ...args];
  if (justCloned) next.push('--skip-pull');
  const result = spawnSync(process.execPath, next, { stdio: 'inherit' });
  process.exit(result.status ?? 1);
}

async function main() {
  if (!IN_REPO) return bootstrap();
  process.chdir(ROOT);
  acquireLock();

  if (!flag('skip-pull')) {
    const selfBefore = fileHash(__filename);
    pull();
    // deploy.js 자체가 업데이트되었으면 새 버전으로 다시 실행
    if (fileHash(__filename) !== selfBefore) {
      log('   ', 'deploy.js 가 변경되어 새 버전으로 다시 실행합니다.');
      fs.unlinkSync(LOCK_FILE);
      const result = spawnSync(process.execPath, [__filename, ...args, '--skip-pull'], { stdio: 'inherit' });
      process.exit(result.status ?? 1);
    }
  } else {
    log('1/5', 'git pull 생략');
  }

  setupServer();
  migrate();
  buildClient();
  await restartServer();
  log('✔', `배포 완료 — ${capture('git', ['log', '-1', '--format=%h %s'])}`);
}

main().catch((err) => {
  console.error(`\x1b[31m[deploy] 실패:\x1b[0m ${err.message}`);
  process.exit(1);
});
