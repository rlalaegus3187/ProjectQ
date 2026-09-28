// 관리자 전용: 캐릭터 스탯 / 프로필 양식으로 무엇을 수집할지(attribute_definitions) 관리
const express = require('express');
const pool = require('../db');
const requireAdmin = require('../middleware/requireAdmin');
const {
  VALUE_TYPES, HttpError, getDefinitions, groupDefinitions, withTransaction, getStatPoints, setStatPoints,
} = require('../characters');

const router = express.Router();
router.use(requireAdmin);

const CODE_RE = /^[a-z][a-z0-9_]{0,49}$/;
const MAX_OPTIONS = 100;

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

function parseValueType(value) {
  if (!VALUE_TYPES.includes(value)) throw new HttpError(400, `형식은 ${VALUE_TYPES.join(', ')} 중 하나여야 합니다.`);
  return value;
}

// 드롭다운 선택지: 배열 또는 줄바꿈으로 구분된 문자열 → 중복/빈 값 제거한 배열
function parseOptions(value) {
  const list = (Array.isArray(value) ? value : String(value ?? '').split('\n'))
    .map((s) => String(s).trim())
    .filter(Boolean);
  const unique = [...new Set(list)];
  if (!unique.length) throw new HttpError(400, '드롭다운 선택지를 1개 이상 입력해주세요.');
  if (unique.length > MAX_OPTIONS) throw new HttpError(400, `선택지는 ${MAX_OPTIONS}개까지 입력할 수 있습니다.`);
  if (unique.some((s) => s.length > 100)) throw new HttpError(400, '선택지는 각각 100자 이내로 입력해주세요.');
  return unique;
}

// 전역 설정: 초기 투자 포인트
router.get('/settings', async (req, res) => {
  res.json({ statPoints: await getStatPoints() });
});

router.put('/settings', async (req, res) => {
  const n = Number(req.body?.statPoints);
  if (!Number.isInteger(n) || n < 0 || n > 1000000) throw new HttpError(400, '투자 포인트는 0 ~ 1,000,000 사이의 정수로 입력해주세요.');
  await setStatPoints(n);
  res.json({ statPoints: n });
});

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
  const valueType = parseValueType(req.body?.valueType ?? (category === 'stat' ? 'number' : 'text'));
  const options = valueType === 'select' ? parseOptions(req.body?.options) : null;

  try {
    const [result] = await pool.execute(
      `INSERT INTO attribute_definitions (category, code, label, value_type, options, is_required, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        category, code, parseLabel(req.body?.label), valueType,
        options && JSON.stringify(options),
        req.body?.isRequired ? 1 : 0, parseSortOrder(req.body?.sortOrder),
      ],
    );
    res.status(201).json({ id: result.insertId });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') throw new HttpError(409, `이미 있는 코드입니다: ${code}`);
    throw err;
  }
});

// 항목 수정 (code/분류는 변경 불가, 형식은 변경 가능)
// 형식을 바꿔도 이미 저장된 값은 그대로 두고, 새 형식에 맞지 않으면 다음 저장 때 다시 입력받음
router.patch('/attributes/:id', async (req, res) => {
  const id = Number(req.params.id);
  const [rows] = await pool.execute('SELECT value_type, options FROM attribute_definitions WHERE id = ?', [id]);
  if (!rows[0]) throw new HttpError(404, '항목을 찾을 수 없습니다.');

  const body = req.body || {};
  const updates = [];
  const params = [];
  if (body.label !== undefined) { updates.push('label = ?'); params.push(parseLabel(body.label)); }
  if (body.isRequired !== undefined) { updates.push('is_required = ?'); params.push(body.isRequired ? 1 : 0); }
  if (body.sortOrder !== undefined) { updates.push('sort_order = ?'); params.push(parseSortOrder(body.sortOrder)); }
  if (body.isActive !== undefined) { updates.push('is_active = ?'); params.push(body.isActive ? 1 : 0); }
  if (body.valueType !== undefined || body.options !== undefined) {
    const valueType = body.valueType !== undefined ? parseValueType(body.valueType) : rows[0].value_type;
    let options = null;
    if (valueType === 'select') {
      // 선택지를 안 보냈으면 기존 선택지 유지
      options = body.options !== undefined ? parseOptions(body.options) : parseOptions(rows[0].options ?? []);
    }
    updates.push('value_type = ?', 'options = ?');
    params.push(valueType, options && JSON.stringify(options));
  }
  if (!updates.length) throw new HttpError(400, '변경할 내용이 없습니다.');

  await pool.execute(`UPDATE attribute_definitions SET ${updates.join(', ')} WHERE id = ?`, [...params, id]);
  res.status(204).end();
});

// 항목 삭제 — 모든 캐릭터에 저장된 이 항목의 값도 함께 삭제
router.delete('/attributes/:id', async (req, res) => {
  const id = Number(req.params.id);
  const deletedValues = await withTransaction(async (conn) => {
    const [stats] = await conn.execute('DELETE FROM character_stats WHERE definition_id = ?', [id]);
    const [details] = await conn.execute('DELETE FROM character_details WHERE definition_id = ?', [id]);
    const [result] = await conn.execute('DELETE FROM attribute_definitions WHERE id = ?', [id]);
    if (!result.affectedRows) throw new HttpError(404, '항목을 찾을 수 없습니다.');
    return stats.affectedRows + details.affectedRows;
  });
  res.json({ deletedValues });
});

module.exports = router;
