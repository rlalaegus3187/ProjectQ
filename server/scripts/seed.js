// 테스트용 샘플 계정(관리자) + 캐릭터를 만듭니다. (이미 있으면 건너뜀)
//   계정: 아이디 demo / 비밀번호 demo1234
const pool = require('../src/db');
const { hashPassword } = require('../src/password');
const {
  getDefinitions, validateCharacterInput, validateProfileInput, DEFAULT_PROFILE_NAME, createCharacter, withTransaction,
} = require('../src/characters');

async function main() {
  const username = 'demo';
  const [existing] = await pool.execute('SELECT id FROM users WHERE username = ?', [username]);
  if (existing.length) {
    console.log('[seed] 샘플 계정이 이미 있습니다.');
    return;
  }

  const defs = await getDefinitions();
  const character = validateCharacterInput({ name: '데모 캐릭터', hp: 100 }, defs);
  const profile = validateProfileInput(
    { details: { original_name: 'Demo Character', age: 20 } },
    defs,
    { defaultName: DEFAULT_PROFILE_NAME },
  );
  const passwordHash = await hashPassword('demo1234');

  await withTransaction(async (conn) => {
    const [result] = await conn.execute(
      "INSERT INTO users (username, contact, role, password_hash) VALUES (?, ?, 'admin', ?)",
      [username, '데모 계정', passwordHash],
    );
    await createCharacter(conn, result.insertId, character, profile);
  });
  console.log('[seed] 샘플 계정 생성: 아이디 demo / 비밀번호 demo1234 (관리자, 캐릭터 포함)');
}

main()
  .catch((err) => {
    console.error('[seed] 실패:', err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
