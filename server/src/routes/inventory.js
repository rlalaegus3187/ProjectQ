// 내 캐릭터 인벤토리 (인벤토리는 캐릭터에 귀속)
const express = require('express');
const pool = require('../db');
const requireAuth = require('../middleware/requireAuth');
const { HttpError } = require('../characters');
const { getInventory, takeItem, parseQuantity } = require('../inventory');

const router = express.Router();
router.use(requireAuth);

async function myCharacterId(req) {
  const [rows] = await pool.execute('SELECT id FROM characters WHERE user_id = ?', [req.session.userId]);
  if (!rows[0]) throw new HttpError(404, '캐릭터가 없습니다. 먼저 캐릭터를 만들어주세요.');
  return rows[0].id;
}

router.get('/', async (req, res) => {
  res.json({ inventory: await getInventory(await myCharacterId(req)) });
});

// 버리기
router.post('/:itemId/discard', async (req, res) => {
  const left = await takeItem({
    characterId: await myCharacterId(req),
    itemId: req.params.itemId,
    quantity: parseQuantity(req.body?.quantity),
  });
  res.json({ quantity: left });
});

module.exports = router;
