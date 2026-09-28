// 테스트용 샘플 계정(관리자) + 캐릭터 + 게시글을 만듭니다. (이미 있으면 건너뜀)
//   계정: demo@projectq.local / demo1234
const pool = require('../src/db');
const { hashPassword } = require('../src/password');
const { getDefinitions, validateCharacterInput, createCharacter, withTransaction } = require('../src/characters');

async function main() {
  const email = 'demo@projectq.local';
  const [existing] = await pool.execute('SELECT id FROM users WHERE email = ?', [email]);
  if (existing.length) {
    console.log('[seed] 샘플 계정이 이미 있습니다.');
    return;
  }

  const character = validateCharacterInput(
    { name: '데모 캐릭터', hp: 100, details: { original_name: 'Demo Character', age: 20 } },
    await getDefinitions(),
  );
  const passwordHash = await hashPassword('demo1234');

  await withTransaction(async (conn) => {
    const [result] = await conn.execute(
      "INSERT INTO users (email, name, role, password_hash) VALUES (?, ?, 'admin', ?)",
      [email, '데모 사용자', passwordHash],
    );
    await createCharacter(conn, result.insertId, character);
    await conn.execute(
      'INSERT INTO posts (user_id, title, body) VALUES (?, ?, ?)',
      [result.insertId, '첫 번째 글', 'ProjectQ 샘플 게시글입니다.'],
    );
  });
  console.log('[seed] 샘플 계정 생성: demo@projectq.local / demo1234 (관리자, 캐릭터 포함)');
}

main()
  .catch((err) => {
    console.error('[seed] 실패:', err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
