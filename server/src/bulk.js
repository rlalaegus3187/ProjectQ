// 관리 화면 일괄 처리 공용: 체크한 행 id 목록 검증
//   const ids = parseIds(req.body?.ids);   → [1, 2, 3] (중복 제거)
const { HttpError } = require('./errors');

const MAX_BULK = 500;

function parseIds(raw, { label = '항목을' } = {}) {   // label: 조사까지 (예: '아이템을')
  if (!Array.isArray(raw) || !raw.length) throw new HttpError(400, `${label} 선택해주세요.`);
  if (raw.length > MAX_BULK) throw new HttpError(400, `한 번에 ${MAX_BULK}개까지 처리할 수 있습니다.`);
  const ids = [...new Set(raw.map(Number))];
  if (ids.some((id) => !Number.isInteger(id) || id <= 0)) throw new HttpError(400, '잘못된 id 가 있습니다.');
  return ids;
}

// 일괄 저장용 목록: [{ id, ... }] → 그대로 (id 만 검증)
function parseRows(raw) {
  if (!Array.isArray(raw) || !raw.length) throw new HttpError(400, '저장할 항목을 선택해주세요.');
  if (raw.length > MAX_BULK) throw new HttpError(400, `한 번에 ${MAX_BULK}개까지 처리할 수 있습니다.`);
  return raw.map((row) => {
    const id = Number(row?.id);
    if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, '잘못된 id 가 있습니다.');
    return { ...row, id };
  });
}

// { key: true/false } 중 보낸 것만 → [['col = ?', 1], ...]  (예: { isActive: 'is_active' })
function pickFlags(body, columns) {
  const sets = [];
  const params = [];
  for (const [key, column] of Object.entries(columns)) {
    if (body?.[key] !== undefined) { sets.push(`${column} = ?`); params.push(body[key] ? 1 : 0); }
  }
  if (!sets.length) throw new HttpError(400, '변경할 내용이 없습니다.');
  return { sets, params };
}

module.exports = { MAX_BULK, parseIds, parseRows, pickFlags };
