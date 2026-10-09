// 관리자: 아이템 관리 + 캐릭터 인벤토리 지급/회수
const express = require('express');
const pool = require('../db');
const requireAdmin = require('../middleware/requireAdmin');
const { HttpError } = require('../characters');
const {
  toItem, getItem, validateItemInput, parseQuantity, giveItem, takeItem, getInventory, getItemLogs, parseId, ITEM_COLUMNS,
} = require('../inventory');
const { getMoney, changeMoney, getMoneyLogs } = require('../money');
const { notify } = require('../notify');
const { parseIds, pickFlags } = require('../bulk');
const { assertEffect } = require('../itemEffects');

const router = express.Router();
router.use(requireAdmin);

// 아이템 목록 (+ 보유 캐릭터 수)
router.get('/items', async (req, res) => {
  const [rows] = await pool.query(
    `SELECT ${ITEM_COLUMNS},
            (SELECT COUNT(*) FROM inventory inv WHERE inv.item_id = items.id) AS owner_count
       FROM items ORDER BY id DESC`,
  );
  res.json({ items: rows.map((r) => ({ ...toItem(r), ownerCount: Number(r.owner_count) })) });
});

router.post('/items', async (req, res) => {
  const d = validateItemInput(req.body);
  await assertEffect(d.effect);
  const [result] = await pool.execute(
    `INSERT INTO items (name, description, small_image, large_image, effect, effect_values, is_bound, is_sellable)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [d.name, d.description, d.smallImage, d.largeImage, d.effect, d.effectValues, d.isBound, d.isSellable],
  );
  res.status(201).json({ item: await getItem(result.insertId) });
});

// 일괄 변경: { ids, isBound?, isSellable? }
router.patch('/items/bulk', async (req, res) => {
  const ids = parseIds(req.body?.ids, { label: '아이템을' });
  const { sets, params } = pickFlags(req.body, { isBound: 'is_bound', isSellable: 'is_sellable' });
  const [result] = await pool.query(`UPDATE items SET ${sets.join(', ')} WHERE id IN (?)`, [...params, ids]);
  res.json({ updated: result.affectedRows });
});

// 일괄 삭제: { ids } — 인벤토리·상점에서도 사라짐 (FK CASCADE)
router.post('/items/bulk-delete', async (req, res) => {
  const ids = parseIds(req.body?.ids, { label: '아이템을' });
  const [result] = await pool.query('DELETE FROM items WHERE id IN (?)', [ids]);
  res.json({ deleted: result.affectedRows });
});

router.put('/items/:id', async (req, res) => {
  const d = validateItemInput(req.body);
  await assertEffect(d.effect);
  const [result] = await pool.execute(
    `UPDATE items SET name = ?, description = ?, small_image = ?, large_image = ?, effect = ?, effect_values = ?,
            is_bound = ?, is_sellable = ? WHERE id = ?`,
    [d.name, d.description, d.smallImage, d.largeImage, d.effect, d.effectValues, d.isBound, d.isSellable, Number(req.params.id)],
  );
  if (!result.affectedRows) throw new HttpError(404, '아이템을 찾을 수 없습니다.');
  res.json({ item: await getItem(req.params.id) });
});

// 삭제 — 모든 인벤토리에서도 사라짐 (FK CASCADE)
router.delete('/items/:id', async (req, res) => {
  const [result] = await pool.execute('DELETE FROM items WHERE id = ?', [Number(req.params.id)]);
  if (!result.affectedRows) throw new HttpError(404, '아이템을 찾을 수 없습니다.');
  res.status(204).end();
});

// 캐릭터 목록·검색 (캐릭터 이름 / 회원 아이디 / 소통 계정) + 보유 아이템 종류·총 개수·소지금
//   ?itemId= 를 주면 그 아이템을 가진 캐릭터만 (보유 수량 포함)
router.get('/characters', async (req, res) => {
  const q = `%${String(req.query.q ?? '').trim()}%`;
  const itemId = req.query.itemId ? parseId(req.query.itemId, '아이템을') : null;
  const [rows] = await pool.query(
    `SELECT c.id, c.name, c.money, u.username, u.contact,
            (SELECT COUNT(*) FROM inventory inv WHERE inv.character_id = c.id) AS item_kinds,
            (SELECT COALESCE(SUM(inv.quantity), 0) FROM inventory inv WHERE inv.character_id = c.id) AS item_total
            ${itemId ? ', own.quantity AS item_quantity' : ''}
       FROM characters c JOIN users u ON u.id = c.user_id
       ${itemId ? 'JOIN inventory own ON own.character_id = c.id AND own.item_id = ?' : ''}
      WHERE c.name LIKE ? OR u.username LIKE ? OR u.contact LIKE ?
      ORDER BY c.name LIMIT 200`,
    itemId ? [itemId, q, q, q] : [q, q, q],
  );
  res.json({
    characters: rows.map((r) => ({
      id: r.id,
      name: r.name,
      username: r.username,
      contact: r.contact,
      money: Number(r.money),
      itemKinds: Number(r.item_kinds),
      itemTotal: Number(r.item_total),
      ...(itemId ? { itemQuantity: Number(r.item_quantity) } : {}),
    })),
  });
});

// 인벤토리 + 아이템 습득/사용 기록 + 소지금 + 최근 소지금 내역
router.get('/characters/:id/inventory', async (req, res) => {
  const characterId = parseId(req.params.id, '캐릭터를');
  const [inventory, itemLogs, money, moneyLogs] = await Promise.all([
    getInventory(characterId), getItemLogs(characterId, { limit: 30 }), getMoney(characterId), getMoneyLogs(characterId, 10),
  ]);
  res.json({ inventory, itemLogs, money, moneyLogs });
});

// 소지금 지급(+)/회수(-): { amount, memo } → 받은 회원에게 알림
router.post('/characters/:id/money', async (req, res) => {
  const amount = Number(req.body?.amount);
  const memo = String(req.body?.memo ?? '').trim() || null;
  const money = await changeMoney({ characterId: req.params.id, amount, reason: 'admin', memo });
  const [rows] = await pool.execute('SELECT user_id FROM characters WHERE id = ?', [Number(req.params.id)]);
  await notify({
    userId: rows[0].user_id,
    type: 'money',
    message: `소지금 ${amount > 0 ? '+' : ''}${amount.toLocaleString()}${memo ? ` (${memo})` : ''} — 잔액 ${money.toLocaleString()}`,
    link: '/inventory',
  });
  res.json({ money });
});

// 지급 { itemId, quantity, memo?(획득처 상세, 예: '1차 이벤트 보상') } → 받은 회원에게 알림
router.post('/characters/:id/inventory', async (req, res) => {
  const quantity = await giveItem({
    characterId: req.params.id,
    itemId: req.body?.itemId,
    quantity: parseQuantity(req.body?.quantity),
    source: 'admin',
    memo: req.body?.memo,
    actorUserId: req.session.userId,
    notifyUser: true,
  });
  res.status(201).json({ quantity });
});

// 회수 ?quantity=&memo=
router.delete('/characters/:id/inventory/:itemId', async (req, res) => {
  const left = await takeItem({
    characterId: req.params.id,
    itemId: req.params.itemId,
    quantity: parseQuantity(req.query.quantity),
    source: 'admin_take',
    memo: req.query.memo,
    actorUserId: req.session.userId,
  });
  res.json({ quantity: left });
});

module.exports = router;
