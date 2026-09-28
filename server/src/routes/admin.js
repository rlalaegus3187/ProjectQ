// 관리자 전용: 캐릭터 스탯/세부정보로 무엇을 수집할지(attribute_definitions) 관리
const express = require('express');
const pool = require('../db');
const requireAdmin = require('../middleware/requireAdmin');
const { HttpError, getDefinitions, groupDefinitions } = require('../characters');

const router = express.Router();
router.use(requireAdmin);

const CODE_RE = /^[a-z][a-z0-9_]{0,49}$/;

function parseLabel(value) {
  const label = String(value ?? '').trim();
  if (!label || label.length > 100) throw new HttpError(400, '표시 이름은 1~100자로 입력해주세요.');
  return label;
}

function parseSortOrder(value) {
  const n = Number(value ?? 0);
  if (!Number.isInteger(n)) throw new HttpError(400, '정렬 순서는 정수로 입력해주세요.');
  return n;
}

// 전체 항목 (비활성 포함)
router.get('/attributes', async (req, res) => {
  res.json(groupDefinitions(await getDefinitions(pool, { activeOnly: false })));
});

// 항목 추가
router.post('/attributes', async (req, res) => {
  const category = req.body?.category;
  if (!['stat', 'detail'].includes(category)) throw new HttpError(400, '분류는 stat 또는 detail 이어야 합니다.');
  const code = String(req.body?.code ?? '').trim();
  if (!CODE_RE.test(code)) throw new HttpError(400, '코드는 영문 소문자로 시작하고 영문 소문자/숫자/_ 로 50자 이내여야 합니다.');
  // 스탯은 항상 숫자
  const valueType = category === 'stat' ? 'number' : req.body?.valueType;
  if (!['number', 'text'].includes(valueType)) throw new HttpError(400, '값 형식은 number 또는 text 여야 합니다.');

  try {
    const [result] = await pool.execute(
      `INSERT INTO attribute_definitions (category, code, label, value_type, is_required, sort_order)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [category, code, parseLabel(req.body?.label), valueType, req.body?.isRequired ? 1 : 0, parseSortOrder(req.body?.sortOrder)],
    );
    res.status(201).json({ id: result.insertId });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') throw new HttpError(409, `이미 있는 코드입니다: ${code}`);
    throw err;
  }
});

// 항목 수정 (code/분류/값 형식은 기존 데이터 보호를 위해 변경 불가)
router.patch('/attributes/:id', async (req, res) => {
  const updates = [];
  const params = [];
  if (req.body?.label !== undefined) { updates.push('label = ?'); params.push(parseLabel(req.body.label)); }
  if (req.body?.isRequired !== undefined) { updates.push('is_required = ?'); params.push(req.body.isRequired ? 1 : 0); }
  if (req.body?.sortOrder !== undefined) { updates.push('sort_order = ?'); params.push(parseSortOrder(req.body.sortOrder)); }
  if (req.body?.isActive !== undefined) { updates.push('is_active = ?'); params.push(req.body.isActive ? 1 : 0); }
  if (!updates.length) throw new HttpError(400, '변경할 내용이 없습니다.');

  const [result] = await pool.execute(
    `UPDATE attribute_definitions SET ${updates.join(', ')} WHERE id = ?`,
    [...params, Number(req.params.id)],
  );
  if (!result.affectedRows) throw new HttpError(404, '항목을 찾을 수 없습니다.');
  res.status(204).end();
});

module.exports = router;
