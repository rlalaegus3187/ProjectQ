// db/migrations/*.sql 을 순서대로, 아직 적용되지 않은 것만 실행합니다.
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const config = require('../src/config');

const MIGRATIONS_DIR = path.join(__dirname, '..', '..', 'db', 'migrations');

// 앱이 쓰는 테이블 — 마이그레이션은 한 번만 실행되므로, 나중에 DB 에서 직접 지운 테이블은 다시 생기지 않음
// → 배포할 때마다 확인해서 빠진 테이블을 알려줌 (복구는 새 마이그레이션 파일로)
const REQUIRED_TABLES = [
  'users', 'sessions', 'posts', 'post_replies', 'notifications', 'settings',
  'attribute_definitions', 'characters', 'character_stats', 'character_profiles', 'character_details',
  'items', 'inventory', 'item_logs', 'money_logs', 'shop_items', 'content_pages', 'content_sections',
];

async function checkTables(conn) {
  const [rows] = await conn.query('SELECT table_name AS name FROM information_schema.tables WHERE table_schema = DATABASE()');
  const existing = new Set(rows.map((r) => r.name));
  const missing = REQUIRED_TABLES.filter((t) => !existing.has(t));
  if (missing.length) {
    console.warn(`[migrate] 경고: DB 에 없는 테이블이 있습니다 → ${missing.join(', ')}`);
    console.warn('[migrate] 이 테이블을 쓰는 기능은 서버 오류가 납니다. 삭제한 적이 있다면 복구 마이그레이션이 필요합니다.');
  } else {
    console.log(`[migrate] 테이블 확인 완료 (${REQUIRED_TABLES.length}개)`);
  }
}

async function main() {
  const conn = await mysql.createConnection({ ...config.db, multipleStatements: true, charset: 'utf8mb4' });
  try {
    await conn.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name        VARCHAR(255) NOT NULL PRIMARY KEY,
        applied_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

    const [rows] = await conn.query('SELECT name FROM schema_migrations');
    const applied = new Set(rows.map((r) => r.name));
    const files = fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort();

    let count = 0;
    for (const file of files) {
      if (applied.has(file)) continue;
      console.log(`[migrate] applying ${file}`);
      await conn.query(fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8'));
      await conn.query('INSERT INTO schema_migrations (name) VALUES (?)', [file]);
      count++;
    }
    console.log(count ? `[migrate] ${count}개 적용 완료` : '[migrate] 적용할 변경 없음');
    await checkTables(conn);
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error('[migrate] 실패:', err.message);
  process.exit(1);
});
