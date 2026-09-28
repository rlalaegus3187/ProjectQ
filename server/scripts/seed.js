// 테스트용 샘플 계정과 게시글을 만듭니다. (이미 있으면 건너뜀)
//   계정: demo@projectq.local / demo1234
const pool = require('../src/db');
const { hashPassword } = require('../src/password');

async function main() {
  const email = 'demo@projectq.local';
  const [existing] = await pool.execute('SELECT id FROM users WHERE email = ?', [email]);
  if (existing.length) {
    console.log('[seed] 샘플 계정이 이미 있습니다.');
    return;
  }
  const [result] = await pool.execute(
    'INSERT INTO users (email, name, password_hash) VALUES (?, ?, ?)',
    [email, '데모 사용자', await hashPassword('demo1234')],
  );
  await pool.execute(
    'INSERT INTO posts (user_id, title, body) VALUES (?, ?, ?)',
    [result.insertId, '첫 번째 글', 'ProjectQ 샘플 게시글입니다.'],
  );
  console.log('[seed] 샘플 계정 생성: demo@projectq.local / demo1234');
}

main()
  .catch((err) => {
    console.error('[seed] 실패:', err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
