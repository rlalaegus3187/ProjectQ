// 테스트용 샘플 계정(관리자) + 캐릭터를 만듭니다. (이미 있으면 건너뜀)
//   계정: 아이디 demo / 비밀번호 demo1234
const pool = require('../src/db');
const { hashPassword } = require('../src/password');
const { getEnabledCosts } = require('../src/costs');
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
  // 필수 항목이 있으면 기본값으로 채움 (숫자 0, 드롭다운 첫 선택지, 그 외 '-')
  const fill = (list) => Object.fromEntries(list.filter((d) => d.isRequired && d.valueType !== 'image')
    .map((d) => [d.code, d.valueType === 'number' ? 0 : d.valueType === 'select' ? d.options?.[0] : d.valueType === 'link' ? 'https://example.com' : '-']));
  const stats = fill(defs.filter((d) => d.category === 'stat'));
  const details = { ...fill(defs.filter((d) => d.category === 'detail')), original_name: 'Demo Character', age: 20 };
  const known = new Set(defs.filter((d) => d.category === 'detail').map((d) => d.code));
  for (const code of Object.keys(details)) if (!known.has(code)) delete details[code];
  const character = validateCharacterInput({ name: '데모 캐릭터', costs: Object.fromEntries([1, 2, 3, 4, 5].map((n) => [n, { current: 100, max: 100 }])), stats }, defs, null, await getEnabledCosts());
  const profile = validateProfileInput(
    { details },
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
