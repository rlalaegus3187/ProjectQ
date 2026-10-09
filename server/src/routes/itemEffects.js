// 아이템 효과 종류
//   공개:   GET /api/item-effects                  [{ code, label, example, description }] (아이템 상세에 효과 이름 표시용)
//   관리자: GET    /api/admin/item-effects          목록 + 쓰는 아이템 수
//           POST   /api/admin/item-effects          추가 { code, label, example, description, sortOrder }
//           PUT    /api/admin/item-effects/:code    수정 { label, example, description, sortOrder } (code 는 못 바꿈)
//           DELETE /api/admin/item-effects/:code    삭제 — 이 효과를 쓰던 아이템은 '효과 없음'(none)으로 바뀜
const express = require('express');
const pool = require('../db');
const requireAdmin = require('../middleware/requireAdmin');
const { HttpError } = require('../errors');
const { withTransaction } = require('../characters');
const { DEFAULT_EFFECT, listEffects, parseEffectInput, parseCode } = require('../itemEffects');

const publicRouter = express.Router();
publicRouter.get('/', async (req, res) => {
  res.json({ effects: await listEffects() });
});

const adminRouter = express.Router();
adminRouter.use('/item-effects', requireAdmin);

adminRouter.get('/item-effects', async (req, res) => {
  res.json({ effects: await listEffects({ withCounts: true }) });
});

adminRouter.post('/item-effects', async (req, res) => {
  const code = parseCode(req.body?.code);
  const d = parseEffectInput(req.body);
  try {
    await pool.execute(
      'INSERT INTO item_effects (code, label, example, description, sort_order) VALUES (?, ?, ?, ?, ?)',
      [code, d.label, d.example, d.description, d.sortOrder],
    );
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') throw new HttpError(409, `'${code}' 코드의 효과가 이미 있습니다.`);
    throw err;
  }
  res.status(201).json({ effects: await listEffects({ withCounts: true }) });
});

adminRouter.put('/item-effects/:code', async (req, res) => {
  const d = parseEffectInput(req.body);
  const [result] = await pool.execute(
    'UPDATE item_effects SET label = ?, example = ?, description = ?, sort_order = ? WHERE code = ?',
    [d.label, d.example, d.description, d.sortOrder, String(req.params.code)],
  );
  if (!result.affectedRows) throw new HttpError(404, '효과를 찾을 수 없습니다.');
  res.json({ effects: await listEffects({ withCounts: true }) });
});

// 삭제: 쓰던 아이템은 '효과 없음'으로 (효과수치는 그대로 남김)
adminRouter.delete('/item-effects/:code', async (req, res) => {
  const code = String(req.params.code);
  if (code === DEFAULT_EFFECT) throw new HttpError(400, "'효과 없음'은 기본 효과라 삭제할 수 없습니다.");
  const changed = await withTransaction(async (conn) => {
    const [items] = await conn.execute('UPDATE items SET effect = ? WHERE effect = ?', [DEFAULT_EFFECT, code]);
    const [result] = await conn.execute('DELETE FROM item_effects WHERE code = ?', [code]);
    if (!result.affectedRows) throw new HttpError(404, '효과를 찾을 수 없습니다.');
    return items.affectedRows;
  });
  res.json({ changedItems: changed, effects: await listEffects({ withCounts: true }) });
});

module.exports = { publicRouter, adminRouter };
