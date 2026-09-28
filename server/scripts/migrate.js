// db/migrations/*.sql 을 순서대로, 아직 적용되지 않은 것만 실행합니다.
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const config = require('../src/config');

const MIGRATIONS_DIR = path.join(__dirname, '..', '..', 'db', 'migrations');

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
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error('[migrate] 실패:', err.message);
  process.exit(1);
});
