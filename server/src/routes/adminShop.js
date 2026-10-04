// 관리자: 상점 관리 (등록된 아이템을 골라 가격·재고를 정해 판매)
const express = require('express');
const pool = require('../db');
const requireAdmin = require('../middleware/requireAdmin');
const { HttpError, withTransaction } = require('../characters');
const { toItem, ITEM_COLUMNS } = require('../inventory');
const { MAX_MONEY } = require('../money');
const { parseIds, parseRows, pickFlags } = require('../bulk');

const router = express.Router();
router.use(requireAdmin);

const itemCols = ITEM_COLUMNS.split(', ').map((c) => `i.${c}`).join(', ');

function parseListing(body) {
  const price = Number(body?.price);
  if (!Number.isSafeInteger(price) || price < 0 || price > MAX_MONEY) throw new HttpError(400, '가격은 0 이상의 정수로 입력해주세요.');
  const stockRaw = body?.stock;
  let stock = null;   // 비우면 무제한
  if (stockRaw !== null && stockRaw !== undefined && String(stockRaw).trim() !== '') {
    stock = Number(stockRaw);
    if (!Number.isInteger(stock) || stock < 0 || stock > 1_000_000) throw new HttpError(400, '재고는 0 이상의 정수로 입력하거나 비워두세요(무제한).');
  }
  const sortOrder = Number(body?.sortOrder ?? 0);
  if (!Number.isInteger(sortOrder)) throw new HttpError(400, '정렬 순서는 정수로 입력해주세요.');
  return { price, stock, isActive: body?.isActive === undefined ? 1 : (body.isActive ? 1 : 0), sortOrder };
}

// 상점 상품 전체 (판매 중지 포함)
router.get('/shop', async (req, res) => {
  const [rows] = await pool.query(
    `SELECT s.id AS shop_id, s.price, s.stock, s.is_active, s.sort_order, ${itemCols}
       FROM shop_items s JOIN items i ON i.id = s.item_id
      ORDER BY s.sort_order, s.id`,
  );
  res.json({
    listings: rows.map((r) => ({
      id: r.shop_id,
      price: Number(r.price),
      stock: r.stock === null ? null : Number(r.stock),
      isActive: !!r.is_active,
      sortOrder: r.sort_order,
      item: toItem(r),
    })),
  });
});

// 상품 등록: { itemId, price, stock?, isActive?, sortOrder? }
router.post('/shop', async (req, res) => {
  const d = parseListing(req.body);
  const itemId = Number(req.body?.itemId);
  const [items] = await pool.execute('SELECT id, name FROM items WHERE id = ?', [itemId]);
  if (!items[0]) throw new HttpError(404, '아이템을 찾을 수 없습니다.');
  try {
    const [result] = await pool.execute(
      'INSERT INTO shop_items (item_id, price, stock, is_active, sort_order) VALUES (?, ?, ?, ?, ?)',
      [itemId, d.price, d.stock, d.isActive, d.sortOrder],
    );
    res.status(201).json({ id: result.insertId });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') throw new HttpError(409, `'${items[0].name}' 은(는) 이미 상점에 있습니다.`);
    throw err;
  }
});

// ---------- 일괄 처리 (/:id 보다 먼저) ----------
// 일괄 저장: { items: [{ id, price, stock, isActive, sortOrder }] } — 하나라도 틀리면 전부 취소
router.put('/shop/bulk', async (req, res) => {
  const rows = parseRows(req.body?.items);
  await withTransaction(async (conn) => {
    for (const row of rows) {
      const d = parseListing(row);
      await conn.execute(
        'UPDATE shop_items SET price = ?, stock = ?, is_active = ?, sort_order = ? WHERE id = ?',
        [d.price, d.stock, d.isActive, d.sortOrder, row.id],
      );
    }
  });
  res.json({ updated: rows.length });
});

// 판매 켜기/끄기: { ids, isActive }
router.patch('/shop/bulk', async (req, res) => {
  const ids = parseIds(req.body?.ids, { label: '상품을' });
  const { sets, params } = pickFlags(req.body, { isActive: 'is_active' });
  const [result] = await pool.query(`UPDATE shop_items SET ${sets.join(', ')} WHERE id IN (?)`, [...params, ids]);
  res.json({ updated: result.affectedRows });
});

// 일괄 내리기: { ids } (아이템 자체와 이미 산 아이템은 그대로)
router.post('/shop/bulk-delete', async (req, res) => {
  const ids = parseIds(req.body?.ids, { label: '상품을' });
  const [result] = await pool.query('DELETE FROM shop_items WHERE id IN (?)', [ids]);
  res.json({ deleted: result.affectedRows });
});

// 상품 수정: { price, stock, isActive, sortOrder }
router.put('/shop/:id', async (req, res) => {
  const d = parseListing(req.body);
  const [result] = await pool.execute(
    'UPDATE shop_items SET price = ?, stock = ?, is_active = ?, sort_order = ? WHERE id = ?',
    [d.price, d.stock, d.isActive, d.sortOrder, Number(req.params.id)],
  );
  if (!result.affectedRows) throw new HttpError(404, '상품을 찾을 수 없습니다.');
  res.status(204).end();
});

router.delete('/shop/:id', async (req, res) => {
  const [result] = await pool.execute('DELETE FROM shop_items WHERE id = ?', [Number(req.params.id)]);
  if (!result.affectedRows) throw new HttpError(404, '상품을 찾을 수 없습니다.');
  res.status(204).end();
});

module.exports = router;
