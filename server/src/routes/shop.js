// 상점: 상품 목록(공개) + 구매(로그인)
const express = require('express');
const pool = require('../db');
const loadViewer = require('../middleware/loadViewer');
const { HttpError, withTransaction } = require('../characters');
const { toItem, giveItem, parseQuantity, ITEM_COLUMNS } = require('../inventory');
const { changeMoney, getMoney } = require('../money');

const router = express.Router();
router.use(loadViewer);

const itemCols = ITEM_COLUMNS.split(', ').map((c) => `i.${c}`).join(', ');

function toListing(r) {
  return {
    id: r.shop_id,
    price: Number(r.price),
    stock: r.stock === null ? null : Number(r.stock),   // null = 무제한
    isActive: !!r.is_active,
    sortOrder: r.sort_order,
    item: toItem(r),
  };
}

async function myCharacterId(viewer) {
  if (!viewer) throw new HttpError(401, '로그인이 필요합니다.');
  const [rows] = await pool.execute('SELECT id FROM characters WHERE user_id = ?', [viewer.id]);
  if (!rows[0]) throw new HttpError(404, '캐릭터가 없습니다. 먼저 캐릭터를 만들어주세요.');
  return rows[0].id;
}

// 판매 중인 상품 목록 (+ 로그인했으면 내 소지금)
router.get('/', async (req, res) => {
  const [rows] = await pool.query(
    `SELECT s.id AS shop_id, s.price, s.stock, s.is_active, s.sort_order, ${itemCols}
       FROM shop_items s JOIN items i ON i.id = s.item_id
      WHERE s.is_active = 1
      ORDER BY s.sort_order, s.id`,
  );
  let money = null;
  if (req.viewer) {
    const [c] = await pool.execute('SELECT id FROM characters WHERE user_id = ?', [req.viewer.id]);
    if (c[0]) money = await getMoney(c[0].id);
  }
  res.json({ listings: rows.map(toListing), money });
});

// 구매: { quantity } — 소지금 차감 + 재고 차감 + 인벤토리 지급 + 내역 기록을 한 트랜잭션으로
router.post('/:id/buy', async (req, res) => {
  const characterId = await myCharacterId(req.viewer);
  const quantity = parseQuantity(req.body?.quantity);

  const result = await withTransaction(async (conn) => {
    const [rows] = await conn.execute(
      `SELECT s.id, s.item_id, s.price, s.stock, s.is_active, i.name
         FROM shop_items s JOIN items i ON i.id = s.item_id
        WHERE s.id = ? FOR UPDATE`,
      [Number(req.params.id)],
    );
    const listing = rows[0];
    if (!listing || !listing.is_active) throw new HttpError(404, '판매 중인 상품이 아닙니다.');
    if (listing.stock !== null && listing.stock < quantity) {
      throw new HttpError(400, listing.stock === 0 ? '품절입니다.' : `재고가 부족합니다. (남은 수량 ${listing.stock})`);
    }
    const total = Number(listing.price) * quantity;
    if (!Number.isSafeInteger(total)) throw new HttpError(400, '금액이 너무 큽니다.');

    const money = total > 0
      ? await changeMoney({ characterId, amount: -total, reason: 'shop_buy', memo: `${listing.name} x${quantity}` }, conn)
      : await getMoney(characterId, conn);
    let stock = listing.stock;
    if (stock !== null) {
      stock -= quantity;
      await conn.execute('UPDATE shop_items SET stock = ? WHERE id = ?', [stock, listing.id]);
    }
    const owned = await giveItem({ characterId, itemId: listing.item_id, quantity }, conn);
    return { money, stock, owned, total, itemName: listing.name };
  });

  res.status(201).json(result);
});

module.exports = router;
