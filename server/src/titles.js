// 칭호(타이틀) 공용 — 관리 → 칭호 관리, 캐릭터 화면, 마이페이지에서 씀
//
//   const { getCharacterTitles, grantTitle } = require('../titles');
//   await getCharacterTitles(characterId)   → [{ id, name, description, color, memo, grantedAt }] (정렬 순서대로)
//   await grantTitles(conn, titleId, [characterId...], { memo, actorUserId })   → 새로 받은 캐릭터 id 목록 (이미 있으면 건너뜀)
//   await revokeTitles(conn, titleId, [characterId...])   → 회수한 수 (대표 칭호였으면 대표도 비움)
const pool = require('./db');
const { HttpError } = require('./errors');

const COLOR_RE = /^#[0-9a-fA-F]{6}$/;

const toTitle = (r) => ({
  id: r.id,
  name: r.name,
  description: r.description || '',
  color: r.color || null,
  sortOrder: r.sort_order,
  ...(r.holder_count !== undefined ? { holderCount: Number(r.holder_count) } : {}),
});

// 관리 화면 목록 (+ 가진 캐릭터 수)
async function listTitles(conn = pool) {
  const [rows] = await conn.query(
    `SELECT t.id, t.name, t.description, t.color, t.sort_order,
            (SELECT COUNT(*) FROM character_titles ct WHERE ct.title_id = t.id) AS holder_count
       FROM titles t ORDER BY t.sort_order, t.id`,
  );
  return rows.map(toTitle);
}

async function findTitle(id, conn = pool) {
  const n = Number(id);
  const [rows] = await conn.execute('SELECT id, name, description, color, sort_order FROM titles WHERE id = ?', [Number.isInteger(n) ? n : 0]);
  if (!rows[0]) throw new HttpError(404, '칭호를 찾을 수 없습니다.');
  return toTitle(rows[0]);
}

// 입력 검증: { name, description, color, sortOrder }
function parseTitleInput(body) {
  const name = String(body?.name ?? '').trim();
  if (!name || name.length > 50) throw new HttpError(400, '칭호 이름은 1~50자로 입력해주세요.');
  const description = String(body?.description ?? '').trim();
  if (description.length > 500) throw new HttpError(400, '설명은 500자 이내로 입력해주세요.');
  const color = String(body?.color ?? '').trim();
  if (color && !COLOR_RE.test(color)) throw new HttpError(400, '색은 #rrggbb 형식으로 입력해주세요.');
  const sortOrder = Number(body?.sortOrder ?? 0);
  if (!Number.isInteger(sortOrder) || Math.abs(sortOrder) > 100000) throw new HttpError(400, '순서는 정수로 입력해주세요.');
  return { name, description: description || null, color: color ? color.toLowerCase() : null, sortOrder };
}

// 캐릭터가 가진 칭호
async function getCharacterTitles(characterId, conn = pool) {
  const [rows] = await conn.execute(
    `SELECT t.id, t.name, t.description, t.color, t.sort_order, ct.memo, ct.granted_at
       FROM character_titles ct JOIN titles t ON t.id = ct.title_id
      WHERE ct.character_id = ? ORDER BY t.sort_order, t.id`,
    [characterId],
  );
  return rows.map((r) => ({ ...toTitle(r), memo: r.memo || '', grantedAt: r.granted_at }));
}

async function grantTitles(conn, titleId, characterIds, { memo = null, actorUserId = null } = {}) {
  if (!characterIds.length) return [];
  const [existing] = await conn.query(
    'SELECT character_id FROM character_titles WHERE title_id = ? AND character_id IN (?)', [titleId, characterIds],
  );
  const have = new Set(existing.map((r) => r.character_id));
  const fresh = characterIds.filter((id) => !have.has(id));
  if (!fresh.length) return [];
  const [found] = await conn.query('SELECT id FROM characters WHERE id IN (?)', [fresh]);
  if (found.length !== fresh.length) throw new HttpError(400, '없는 캐릭터가 섞여 있습니다. 새로고침 후 다시 시도해주세요.');
  await conn.query(
    'INSERT INTO character_titles (character_id, title_id, memo, granted_by) VALUES ?',
    [fresh.map((id) => [id, titleId, memo, actorUserId])],
  );
  return fresh;
}

async function revokeTitles(conn, titleId, characterIds) {
  if (!characterIds.length) return 0;
  const [result] = await conn.query('DELETE FROM character_titles WHERE title_id = ? AND character_id IN (?)', [titleId, characterIds]);
  await conn.query('UPDATE characters SET main_title_id = NULL WHERE main_title_id = ? AND id IN (?)', [titleId, characterIds]);
  return result.affectedRows;
}

module.exports = { listTitles, findTitle, parseTitleInput, getCharacterTitles, grantTitles, revokeTitles };
