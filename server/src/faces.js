// 캐릭터 표정(두상) — character_faces. 마이페이지에서 등록하고 채팅에서 골라 씀
//   code = '<캐릭터 id>_<캐릭터 안 번호>' (자동), 이미지는 올린 파일 또는 링크 (images.js)
//   채팅 메시지는 face_id 로 표정을 가리킴 → 기록을 볼 때 이 표의 이미지를 찾아 보여줌
const pool = require('./db');
const { HttpError } = require('./errors');
const { parseImageUrl } = require('./images');
const { withTransaction } = require('./characters');

const MAX_FACES = 30;   // 캐릭터 하나에 표정 최대 개수

const toFace = (r) => ({ id: r.id, code: r.code, name: r.name, image: r.image, seq: r.seq });

async function characterIdOf(userId, conn = pool) {
  const [[row]] = await conn.execute('SELECT id FROM characters WHERE user_id = ?', [userId]);
  if (!row) throw new HttpError(400, '캐릭터를 먼저 만들어주세요. (마이페이지)');
  return row.id;
}

// 내 표정 목록 (번호 순) — 캐릭터가 없으면 []
async function listFaces(userId, conn = pool) {
  const [rows] = await conn.execute(
    `SELECT f.* FROM character_faces f JOIN characters c ON c.id = f.character_id WHERE c.user_id = ? ORDER BY f.seq`,
    [userId],
  );
  return rows.map(toFace);
}

function parseFace(body) {
  const name = String(body?.name ?? '').trim();
  if (!name || name.length > 30) throw new HttpError(400, '표정 이름은 1~30자로 입력해주세요.');
  return { name, image: parseImageUrl(body?.image, { label: '표정 이미지', required: true }) };
}

// 추가 → 번호·code 자동 (같은 캐릭터 동시 추가는 잠금으로 순서대로)
async function createFace(userId, body) {
  const d = parseFace(body);
  return withTransaction(async (conn) => {
    const [[ch]] = await conn.execute('SELECT id FROM characters WHERE user_id = ? FOR UPDATE', [userId]);
    if (!ch) throw new HttpError(400, '캐릭터를 먼저 만들어주세요. (마이페이지)');
    const [[{ n, last }]] = await conn.execute('SELECT COUNT(*) AS n, COALESCE(MAX(seq), 0) AS last FROM character_faces WHERE character_id = ?', [ch.id]);
    if (Number(n) >= MAX_FACES) throw new HttpError(400, `표정은 ${MAX_FACES}개까지 등록할 수 있습니다.`);
    const seq = Number(last) + 1;
    const [r] = await conn.execute(
      'INSERT INTO character_faces (character_id, seq, code, name, image) VALUES (?, ?, ?, ?, ?)',
      [ch.id, seq, `${ch.id}_${seq}`, d.name, d.image],
    );
    return r.insertId;
  });
}

async function updateFace(userId, faceId, body) {
  const d = parseFace(body);
  const characterId = await characterIdOf(userId);
  const [r] = await pool.execute('UPDATE character_faces SET name = ?, image = ? WHERE id = ? AND character_id = ?',
    [d.name, d.image, Number(faceId) || 0, characterId]);
  if (!r.affectedRows) throw new HttpError(404, '없는 표정입니다.');
}

// 삭제 — 그 표정으로 말한 채팅은 남고 두상만 기본 모양 (face_id → NULL)
async function deleteFace(userId, faceId) {
  const characterId = await characterIdOf(userId);
  const [r] = await pool.execute('DELETE FROM character_faces WHERE id = ? AND character_id = ?', [Number(faceId) || 0, characterId]);
  if (!r.affectedRows) throw new HttpError(404, '없는 표정입니다.');
}

// 채팅: 고른 표정이 내 것인지 → face id (없거나 비우면 null)
async function ownFaceId(userId, faceId, conn = pool) {
  const id = Number(faceId) || 0;
  if (!id) return null;
  const [[row]] = await conn.execute(
    'SELECT f.id FROM character_faces f JOIN characters c ON c.id = f.character_id WHERE f.id = ? AND c.user_id = ?', [id, userId],
  );
  if (!row) throw new HttpError(400, '내 표정만 고를 수 있습니다. (지워졌을 수 있음 — 다시 골라주세요)');
  return row.id;
}

module.exports = { MAX_FACES, listFaces, createFace, updateFace, deleteFace, ownFaceId };
