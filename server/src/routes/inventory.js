// 내 캐릭터 인벤토리 (인벤토리는 캐릭터에 귀속)
const express = require('express');
const pool = require('../db');
const requireAuth = require('../middleware/requireAuth');
const { HttpError } = require('../characters');
const { getInventory, getItemLogs, takeItem, parseQuantity } = require('../inventory');
const { getMoney, getMoneyLogs } = require('../money');

const router = express.Router();
router.use(requireAuth);

async function myCharacterId(req) {
  const [rows] = await pool.execute('SELECT id FROM characters WHERE user_id = ?', [req.session.userId]);
  if (!rows[0]) throw new HttpError(404, '캐릭터가 없습니다. 먼저 캐릭터를 만들어주세요.');
  return rows[0].id;
}

// 인벤토리 + 소지금 + 최근 소지금 내역
router.get('/', async (req, res) => {
  const characterId = await myCharacterId(req);
  const [inventory, itemLogs, money, moneyLogs] = await Promise.all([
    getInventory(characterId), getItemLogs(characterId, { limit: 20 }), getMoney(characterId), getMoneyLogs(characterId, 20),
  ]);
  res.json({ inventory, itemLogs, money, moneyLogs });
});

// 아이템 하나의 습득/사용 기록 (언제·어디서 얻었는지)
router.get('/:itemId/logs', async (req, res) => {
  res.json({ logs: await getItemLogs(await myCharacterId(req), { itemId: req.params.itemId, limit: 50 }) });
});

// 버리기
router.post('/:itemId/discard', async (req, res) => {
  const left = await takeItem({
    characterId: await myCharacterId(req),
    itemId: req.params.itemId,
    quantity: parseQuantity(req.body?.quantity),
    source: 'discard',
    actorUserId: req.session.userId,
  });
  res.json({ quantity: left });
});

module.exports = router;
