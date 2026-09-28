// 아이템 / 인벤토리 — 서버 어디서든 불러 쓰는 공용 함수
//
//   const { giveItem, takeItem, getInventory } = require('../inventory');
//
//   // 캐릭터에게 아이템 지급 (이미 있으면 수량이 더해짐) → 지급 후 수량
//   await giveItem({ characterId: 3, itemId: 10, quantity: 2 });
//   await giveItem({ characterId: 3, itemId: 10, quantity: 1, notifyUser: true });   // 받은 사람에게 알림
//
//   // 회수/사용/버리기 (수량이 0 이 되면 인벤토리에서 삭제) → 남은 수량
//   await takeItem({ characterId: 3, itemId: 10, quantity: 1 });
//
//   // 인벤토리 조회 → [{ item: {...}, quantity, acquiredAt }]
//   await getInventory(3);
//
//   // 트랜잭션 안에서는 마지막 인자로 커넥션 → 함께 커밋/롤백
//   await withTransaction(async (conn) => { await takeItem({...}, conn); await giveItem({...}, conn); });
const pool = require('./db');
const { HttpError, UPLOAD_URL_RE } = require('./characters');
const { notify } = require('./notify');

// 효과 종류 (DB ENUM 과 같아야 함)
const EFFECTS = ['none', 'hp_recover', 'stat_bonus', 'custom'];
const MAX_QUANTITY = 99999;

function parseJson(value) {
  if (value === null || value === undefined) return {};
  if (typeof value === 'object') return value;
  try { return JSON.parse(value); } catch { return {}; }
}

function toItem(row) {
  return {
    id: row.id,
    name: row.name,
    description: row.description || '',
    smallImage: row.small_image,
    largeImage: row.large_image,
    effect: row.effect,
    effectValues: parseJson(row.effect_values),
    isBound: !!row.is_bound,
    isSellable: !!row.is_sellable,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const ITEM_COLUMNS = 'id, name, description, small_image, large_image, effect, effect_values, is_bound, is_sellable, created_at, updated_at';

async function getItem(itemId, conn = pool) {
  const [rows] = await conn.execute(`SELECT ${ITEM_COLUMNS} FROM items WHERE id = ?`, [Number(itemId)]);
  if (!rows[0]) throw new HttpError(404, '아이템을 찾을 수 없습니다.');
  return toItem(rows[0]);
}

// 관리자 입력 검증 → DB 에 넣을 값
function validateItemInput(body) {
  const name = String(body?.name ?? '').trim();
  if (!name || name.length > 100) throw new HttpError(400, '아이템 이름은 1~100자로 입력해주세요.');
  const description = String(body?.description ?? '').trim();
  if (description.length > 10000) throw new HttpError(400, '설명은 10,000자 이내로 입력해주세요.');

  const image = (value, label) => {
    const v = String(value ?? '').trim();
    if (!v) return null;
    if (!UPLOAD_URL_RE.test(v)) throw new HttpError(400, `${label}를 다시 업로드해주세요.`);
    return v;
  };

  const effect = body?.effect ?? 'none';
  if (!EFFECTS.includes(effect)) throw new HttpError(400, `효과는 ${EFFECTS.join(', ')} 중 하나여야 합니다.`);

  // 효과수치: JSON 객체 (문자열로 와도 파싱)
  let values = body?.effectValues ?? {};
  if (typeof values === 'string') {
    try { values = values.trim() ? JSON.parse(values) : {}; } catch { throw new HttpError(400, '효과수치가 올바른 JSON 이 아닙니다.'); }
  }
  if (values === null || typeof values !== 'object' || Array.isArray(values)) {
    throw new HttpError(400, '효과수치는 {"키": 값} 형태의 JSON 객체여야 합니다.');
  }
  const json = JSON.stringify(values);
  if (json.length > 2000) throw new HttpError(400, '효과수치가 너무 깁니다. (2,000자 이내)');

  return {
    name,
    description: description || null,
    smallImage: image(body?.smallImage, '작은 이미지'),
    largeImage: image(body?.largeImage, '큰 이미지'),
    effect,
    effectValues: json,
    isBound: body?.isBound ? 1 : 0,
    isSellable: body?.isSellable ? 1 : 0,
  };
}

function parseQuantity(value) {
  const n = Number(value ?? 1);
  if (!Number.isInteger(n) || n < 1 || n > MAX_QUANTITY) throw new HttpError(400, `수량은 1 ~ ${MAX_QUANTITY} 사이의 정수로 입력해주세요.`);
  return n;
}

// 트랜잭션이 아니면 내부에서 트랜잭션을 열어서 실행 (행 잠금이 필요하므로)
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

// 지급 → 지급 후 보유 수량
async function giveItem({ characterId, itemId, quantity = 1, notifyUser = false }, conn = pool) {
  const qty = parseQuantity(quantity);
  return inTransaction(conn, async (c) => {
    const item = await getItem(itemId, c);
    const [chars] = await c.execute('SELECT id, user_id FROM characters WHERE id = ?', [Number(characterId)]);
    if (!chars[0]) throw new HttpError(404, '캐릭터를 찾을 수 없습니다.');

    const [rows] = await c.execute(
      'SELECT quantity FROM inventory WHERE character_id = ? AND item_id = ? FOR UPDATE',
      [chars[0].id, item.id],
    );
    const total = (rows[0]?.quantity ?? 0) + qty;
    if (total > MAX_QUANTITY) throw new HttpError(400, `한 아이템은 최대 ${MAX_QUANTITY}개까지 가질 수 있습니다.`);
    await c.execute(
      `INSERT INTO inventory (character_id, item_id, quantity) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE quantity = ?`,
      [chars[0].id, item.id, qty, total],
    );
    if (notifyUser) {
      await notify({
        userId: chars[0].user_id,
        type: 'item_received',
        message: `아이템 '${item.name}' ${qty}개를 받았습니다.`,
        link: '/inventory',
      }, c);
    }
    return total;
  });
}

// 회수/사용/버리기 → 남은 수량 (0 이면 삭제됨)
async function takeItem({ characterId, itemId, quantity = 1 }, conn = pool) {
  const qty = parseQuantity(quantity);
  return inTransaction(conn, async (c) => {
    const [rows] = await c.execute(
      'SELECT quantity FROM inventory WHERE character_id = ? AND item_id = ? FOR UPDATE',
      [Number(characterId), Number(itemId)],
    );
    if (!rows[0]) throw new HttpError(404, '인벤토리에 없는 아이템입니다.');
    if (rows[0].quantity < qty) throw new HttpError(400, `보유 수량(${rows[0].quantity})보다 많이 뺄 수 없습니다.`);
    const left = rows[0].quantity - qty;
    if (left === 0) {
      await c.execute('DELETE FROM inventory WHERE character_id = ? AND item_id = ?', [Number(characterId), Number(itemId)]);
    } else {
      await c.execute('UPDATE inventory SET quantity = ? WHERE character_id = ? AND item_id = ?', [left, Number(characterId), Number(itemId)]);
    }
    return left;
  });
}

// 인벤토리 조회 (최근에 얻은 순)
async function getInventory(characterId, conn = pool) {
  const [rows] = await conn.execute(
    `SELECT inv.quantity, inv.acquired_at, i.${ITEM_COLUMNS.split(', ').join(', i.')}
       FROM inventory inv JOIN items i ON i.id = inv.item_id
      WHERE inv.character_id = ?
      ORDER BY inv.acquired_at DESC, inv.id DESC`,
    [Number(characterId)],
  );
  return rows.map((r) => ({ item: toItem(r), quantity: r.quantity, acquiredAt: r.acquired_at }));
}

module.exports = {
  EFFECTS,
  MAX_QUANTITY,
  toItem,
  getItem,
  validateItemInput,
  parseQuantity,
  giveItem,
  takeItem,
  getInventory,
  ITEM_COLUMNS,
};
