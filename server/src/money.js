// 소지금 — 서버 어디서든 불러 쓰는 공용 함수 (캐릭터 귀속, 모든 변화는 money_logs 에 기록)
//
//   const { getMoney, changeMoney, getMoneyLogs } = require('../money');
//
//   await changeMoney({ characterId, amount: 500, reason: 'event', memo: '출석 보상' });   // 지급 → 잔액
//   await changeMoney({ characterId, amount: -300, reason: 'shop_buy', memo: '회복 포션 x3' }); // 차감 (부족하면 400)
//   await getMoney(characterId);             // 잔액
//   await getMoneyLogs(characterId, 20);     // 최근 내역
//
//   // 트랜잭션 안에서는 마지막 인자로 커넥션 → 함께 커밋/롤백 (상점 구매처럼 여러 작업을 묶을 때)
//   await withTransaction(async (conn) => { await changeMoney({...}, conn); await giveItem({...}, conn); });
const pool = require('./db');
const { HttpError } = require('./characters');

const MAX_MONEY = 1_000_000_000_000;   // 1조
const REASON_RE = /^[a-z][a-z0-9_]{0,29}$/;

async function inTransaction(conn, fn) {
  if (conn !== pool) return fn(conn);
  const c = await pool.getConnection();
  try {
    await c.beginTransaction();
    const result = await fn(c);
    await c.commit();
    return result;
  } catch (err) {
    await c.rollback();
    throw err;
  } finally {
    c.release();
  }
}

async function getMoney(characterId, conn = pool) {
  const [rows] = await conn.execute('SELECT money FROM characters WHERE id = ?', [Number(characterId)]);
  if (!rows[0]) throw new HttpError(404, '캐릭터를 찾을 수 없습니다.');
  return Number(rows[0].money);
}

// amount: + 지급 / - 차감 → 변경 후 잔액. 잔액이 모자라면 400 (아무것도 바뀌지 않음)
async function changeMoney({ characterId, amount, reason, memo = null }, conn = pool) {
  const delta = Number(amount);
  if (!Number.isSafeInteger(delta) || delta === 0 || Math.abs(delta) > MAX_MONEY) {
    throw new HttpError(400, '금액은 0 이 아닌 정수로 입력해주세요.');
  }
  if (!REASON_RE.test(String(reason ?? ''))) throw new Error(`changeMoney: 잘못된 reason (${reason})`);
  const note = memo === null || memo === undefined ? null : String(memo).trim().slice(0, 255) || null;

  return inTransaction(conn, async (c) => {
    // 행 잠금: 동시에 여러 요청이 와도 잔액이 꼬이지 않게
    const [rows] = await c.execute('SELECT money FROM characters WHERE id = ? FOR UPDATE', [Number(characterId)]);
    if (!rows[0]) throw new HttpError(404, '캐릭터를 찾을 수 없습니다.');
    const balance = Number(rows[0].money) + delta;
    if (balance < 0) throw new HttpError(400, `소지금이 부족합니다. (보유 ${Number(rows[0].money).toLocaleString()} / 필요 ${(-delta).toLocaleString()})`);
    if (balance > MAX_MONEY) throw new HttpError(400, '소지금 한도를 넘습니다.');
    await c.execute('UPDATE characters SET money = ? WHERE id = ?', [balance, Number(characterId)]);
    await c.execute(
      'INSERT INTO money_logs (character_id, amount, balance, reason, memo) VALUES (?, ?, ?, ?, ?)',
      [Number(characterId), delta, balance, reason, note],
    );
    return balance;
  });
}

async function getMoneyLogs(characterId, limit = 20, conn = pool) {
  const [rows] = await conn.query(
    'SELECT id, amount, balance, reason, memo, created_at FROM money_logs WHERE character_id = ? ORDER BY id DESC LIMIT ?',
    [Number(characterId), Math.min(Math.max(Number(limit) || 20, 1), 100)],
  );
  return rows.map((r) => ({
    id: r.id, amount: Number(r.amount), balance: Number(r.balance), reason: r.reason, memo: r.memo, createdAt: r.created_at,
  }));
}

module.exports = { MAX_MONEY, getMoney, changeMoney, getMoneyLogs };
