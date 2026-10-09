// 아이템 / 인벤토리 — 서버 어디서든 불러 쓰는 공용 함수
//
//   const { giveItem, takeItem, getInventory } = require('../inventory');
//
//   // 캐릭터에게 아이템 지급 (이미 있으면 수량이 더해짐) → 지급 후 수량
//   // source = 어디서 얻었는지 (item_logs 에 시각과 함께 기록), memo = 상세
//   await giveItem({ characterId: 3, itemId: 10, quantity: 2, source: 'event', memo: '출석 보상' });
//   await giveItem({ characterId: 3, itemId: 10, source: 'admin', actorUserId: 1, notifyUser: true });   // 받은 사람에게 알림
//
//   // 회수/사용/버리기 (수량이 0 이 되면 인벤토리에서 삭제) → 남은 수량
//   await takeItem({ characterId: 3, itemId: 10, quantity: 1, source: 'use' });
//
//   // 인벤토리 조회 → [{ item, quantity, acquiredAt(처음), lastAcquiredAt, lastSource, lastMemo }]
//   await getInventory(3);
//   // 습득/사용 기록 → [{ id, item: { id, name, image }, amount, quantityAfter, source, memo, createdAt }]
//   await getItemLogs(3, { itemId: 10, limit: 20 });
//
//   // 트랜잭션 안에서는 마지막 인자로 커넥션 → 함께 커밋/롤백
//   await withTransaction(async (conn) => { await takeItem({...}, conn); await giveItem({...}, conn); });
const pool = require('./db');
const { HttpError, UPLOAD_URL_RE } = require('./characters');
const { notify } = require('./notify');

const MAX_QUANTITY = 99999;
// 획득처/사유 코드: admin, shop, admin_take, discard, legacy ... (영문 소문자·숫자·_ 30자)
const SOURCE_RE = /^[a-z][a-z0-9_]{0,29}$/;

// 숫자 id 검증 (잘못된 값이 DB 까지 가서 서버 오류가 나지 않게)
function parseId(value, label) {   // label: '아이템을' 처럼 조사까지
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) throw new HttpError(400, `${label} 선택해주세요.`);
  return n;
}

function logFields({ source, memo }) {
  if (!SOURCE_RE.test(String(source ?? ''))) throw new Error(`inventory: 잘못된 source (${source})`);
  const note = memo === null || memo === undefined ? null : String(memo).trim().slice(0, 255) || null;
  return { source, memo: note };
}

async function writeLog(c, { characterId, itemId, amount, quantityAfter, source, memo, actorUserId }) {
  await c.execute(
    `INSERT INTO item_logs (character_id, item_id, amount, quantity_after, source, memo, actor_user_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [characterId, itemId, amount, quantityAfter, source, memo, actorUserId ?? null],
  );
}

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
    image: row.image,   // 아이템 이미지 하나 (목록·인벤토리 칸·상세 모두)
    effect: row.effect,
    effectValues: parseJson(row.effect_values),
    isBound: !!row.is_bound,
    isSellable: !!row.is_sellable,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const ITEM_COLUMNS = 'id, name, description, image, effect, effect_values, is_bound, is_sellable, created_at, updated_at';

async function getItem(itemId, conn = pool) {
  const [rows] = await conn.execute(`SELECT ${ITEM_COLUMNS} FROM items WHERE id = ?`, [parseId(itemId, '아이템을')]);
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

  // 효과 종류는 item_effects 테이블 (있는지는 저장할 때 assertEffect 로 확인)
  const effect = String(body?.effect ?? 'none');

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
    image: image(body?.image, '이미지'),
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

// 지급 → 지급 후 보유 수량 (item_logs 에 + 기록)
async function giveItem({
  characterId, itemId, quantity = 1, source = 'system', memo = null, actorUserId = null, notifyUser = false,
}, conn = pool) {
  const qty = parseQuantity(quantity);
  const log = logFields({ source, memo });
  const charId = parseId(characterId, '캐릭터를');
  return inTransaction(conn, async (c) => {
    const item = await getItem(itemId, c);
    const [chars] = await c.execute('SELECT id, user_id FROM characters WHERE id = ?', [charId]);
    if (!chars[0]) throw new HttpError(404, '캐릭터를 찾을 수 없습니다.');

    const [rows] = await c.execute(
      'SELECT quantity FROM inventory WHERE character_id = ? AND item_id = ? FOR UPDATE',
      [charId, item.id],
    );
    const total = Number(rows[0]?.quantity ?? 0) + qty;
    if (total > MAX_QUANTITY) throw new HttpError(400, `한 아이템은 최대 ${MAX_QUANTITY}개까지 가질 수 있습니다.`);
    if (rows[0]) {
      await c.execute(
        'UPDATE inventory SET quantity = ?, last_acquired_at = NOW() WHERE character_id = ? AND item_id = ?',
        [total, charId, item.id],
      );
    } else {
      await c.execute(
        'INSERT INTO inventory (character_id, item_id, quantity, acquired_at, last_acquired_at) VALUES (?, ?, ?, NOW(), NOW())',
        [charId, item.id, total],
      );
    }
    await writeLog(c, {
      characterId: charId, itemId: item.id, amount: qty, quantityAfter: total, ...log, actorUserId,
    });
    if (notifyUser) {
      await notify({
        userId: chars[0].user_id,
        type: 'item_received',
        message: `아이템 '${item.name}' ${qty}개를 받았습니다.${log.memo ? ` (${log.memo})` : ''}`,
        link: '/inventory',
      }, c);
    }
    return total;
  });
}

// 회수/사용/버리기 → 남은 수량 (0 이면 삭제됨, item_logs 에 - 기록)
async function takeItem({
  characterId, itemId, quantity = 1, source = 'system', memo = null, actorUserId = null,
}, conn = pool) {
  const qty = parseQuantity(quantity);
  const log = logFields({ source, memo });
  const charId = parseId(characterId, '캐릭터를');
  const iid = parseId(itemId, '아이템을');
  return inTransaction(conn, async (c) => {
    const [rows] = await c.execute(
      'SELECT quantity FROM inventory WHERE character_id = ? AND item_id = ? FOR UPDATE',
      [charId, iid],
    );
    if (!rows[0]) throw new HttpError(404, '인벤토리에 없는 아이템입니다.');
    if (rows[0].quantity < qty) throw new HttpError(400, `보유 수량(${rows[0].quantity})보다 많이 뺄 수 없습니다.`);
    const left = rows[0].quantity - qty;
    if (left === 0) {
      await c.execute('DELETE FROM inventory WHERE character_id = ? AND item_id = ?', [charId, iid]);
    } else {
      await c.execute('UPDATE inventory SET quantity = ? WHERE character_id = ? AND item_id = ?', [left, charId, iid]);
    }
    await writeLog(c, {
      characterId: charId, itemId: iid, amount: -qty, quantityAfter: left, ...log, actorUserId,
    });
    return left;
  });
}

// 인벤토리 조회 (최근에 얻은 순) + 마지막 습득 기록(어디서)
async function getInventory(characterId, conn = pool) {
  const [rows] = await conn.execute(
    `SELECT inv.quantity, inv.acquired_at, inv.last_acquired_at, i.${ITEM_COLUMNS.split(', ').join(', i.')},
            last_log.source AS last_source, last_log.memo AS last_memo
       FROM inventory inv
       JOIN items i ON i.id = inv.item_id
       LEFT JOIN item_logs last_log ON last_log.id = (
         SELECT l.id FROM item_logs l
          WHERE l.character_id = inv.character_id AND l.item_id = inv.item_id AND l.amount > 0
          ORDER BY l.id DESC LIMIT 1)
      WHERE inv.character_id = ?
      ORDER BY COALESCE(inv.last_acquired_at, inv.acquired_at) DESC, inv.id DESC`,
    [parseId(characterId, '캐릭터를')],
  );
  return rows.map((r) => ({
    item: toItem(r),
    quantity: r.quantity,
    acquiredAt: r.acquired_at,
    lastAcquiredAt: r.last_acquired_at ?? r.acquired_at,
    lastSource: r.last_source,
    lastMemo: r.last_memo,
  }));
}

// 습득/사용 기록 (최근 순). itemId 를 주면 그 아이템만
async function getItemLogs(characterId, { itemId = null, limit = 20 } = {}, conn = pool) {
  const params = [parseId(characterId, '캐릭터를')];
  let where = 'l.character_id = ?';
  if (itemId !== null && itemId !== undefined) { where += ' AND l.item_id = ?'; params.push(parseId(itemId, '아이템을')); }
  params.push(Math.min(Math.max(Number(limit) || 20, 1), 100));
  const [rows] = await conn.query(
    `SELECT l.id, l.item_id, i.name, i.image, l.amount, l.quantity_after, l.source, l.memo, l.created_at,
            u.username AS actor_name
       FROM item_logs l
       JOIN items i ON i.id = l.item_id
       LEFT JOIN users u ON u.id = l.actor_user_id
      WHERE ${where}
      ORDER BY l.id DESC LIMIT ?`,
    params,
  );
  return rows.map((r) => ({
    id: r.id,
    item: { id: r.item_id, name: r.name, image: r.image },
    amount: r.amount,
    quantityAfter: r.quantity_after,
    source: r.source,
    memo: r.memo,
    actorName: r.actor_name,
    createdAt: r.created_at,
  }));
}

module.exports = {
  MAX_QUANTITY,
  toItem,
  getItem,
  validateItemInput,
  parseQuantity,
  giveItem,
  takeItem,
  getInventory,
  getItemLogs,
  parseId,
  ITEM_COLUMNS,
};
