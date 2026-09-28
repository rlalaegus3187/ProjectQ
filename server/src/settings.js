// 전역 설정 (settings 테이블 키-값) 읽기/쓰기
const pool = require('./db');

async function getSetting(name, conn = pool) {
  const [rows] = await conn.execute('SELECT value FROM settings WHERE name = ?', [name]);
  return rows[0]?.value ?? null;
}

// value 가 null 이면 삭제
async function setSetting(name, value, conn = pool) {
  if (value === null || value === undefined) {
    await conn.execute('DELETE FROM settings WHERE name = ?', [name]);
  } else {
    await conn.execute(
      'INSERT INTO settings (name, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value = VALUES(value)',
      [name, String(value)],
    );
  }
}

module.exports = { getSetting, setSetting };
