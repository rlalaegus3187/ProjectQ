// 채팅용 두상(표정) — character_faces. 프로필마다 여러 개 (프로필 수정 팝업의 '채팅용 두상'에서 등록)
//   code = '<캐릭터 id>_<캐릭터 안 번호>' (자동), 이미지는 올린 파일 또는 링크 (images.js)
//   채팅에서는 대표 프로필의 두상을 골라 씀. 메시지는 face_id 로 두상을 가리킴 → 기록을 볼 때 이 표의 이미지를 찾아 보여줌
const pool = require('./db');
const { HttpError } = require('./errors');
const { parseImageUrl } = require('./images');

const MAX_FACES = 30;   // 프로필 하나에 두상 최대 개수

const toFace = (r) => ({ id: r.id, code: r.code, name: r.name, image: r.image });

// 프로필 입력의 faces: [{ id?, name, image }] → 검사한 목록 (undefined 면 건드리지 않음)
function parseFaces(input) {
  if (input === undefined) return undefined;
  if (!Array.isArray(input)) throw new HttpError(400, '채팅용 두상 목록이 올바르지 않습니다.');
  if (input.length > MAX_FACES) throw new HttpError(400, `채팅용 두상은 프로필마다 ${MAX_FACES}개까지 등록할 수 있습니다.`);
  return input.map((f, i) => {
    const name = String(f?.name ?? '').trim();
    if (!name || name.length > 30) throw new HttpError(400, `채팅용 두상 ${i + 1}번: 이름을 1~30자로 입력해주세요.`);
    return { id: Number(f?.id) || null, name, image: parseImageUrl(f?.image, { label: `채팅용 두상 ${i + 1}번(${name}) 이미지`, required: true }) };
  });
}

// 프로필의 두상 저장 (트랜잭션 안에서) — 목록에 없는 것은 삭제, id 가 있으면 수정, 없으면 새로 (번호·code 자동)
async function saveFaces(conn, characterId, profileId, faces) {
  if (faces === undefined) return;
  const [rows] = await conn.execute('SELECT id FROM character_faces WHERE profile_id = ?', [profileId]);
  const existing = new Set(rows.map((r) => r.id));
  const keep = faces.filter((f) => f.id && existing.has(f.id));
  const removed = [...existing].filter((id) => !keep.some((f) => f.id === id));
  if (removed.length) await conn.query('DELETE FROM character_faces WHERE id IN (?)', [removed]);
  for (const f of keep) await conn.execute('UPDATE character_faces SET name = ?, image = ? WHERE id = ?', [f.name, f.image, f.id]);
  const added = faces.filter((f) => !keep.includes(f));
  if (!added.length) return;
  const [[{ last }]] = await conn.execute('SELECT COALESCE(MAX(seq), 0) AS last FROM character_faces WHERE character_id = ? FOR UPDATE', [characterId]);
  let seq = Number(last);
  for (const f of added) {
    seq += 1;
    await conn.execute('INSERT INTO character_faces (character_id, profile_id, seq, code, name, image) VALUES (?, ?, ?, ?, ?, ?)',
      [characterId, profileId, seq, `${characterId}_${seq}`, f.name, f.image]);
  }
}

// 프로필 id 들 → Map(profileId → [두상])
async function facesByProfile(profileIds, conn = pool) {
  const map = new Map();
  if (!profileIds.length) return map;
  const [rows] = await conn.query('SELECT * FROM character_faces WHERE profile_id IN (?) ORDER BY seq', [profileIds]);
  for (const r of rows) {
    if (!map.has(r.profile_id)) map.set(r.profile_id, []);
    map.get(r.profile_id).push(toFace(r));
  }
  return map;
}

// 채팅에서 고를 두상 = 대표 프로필의 두상 (캐릭터가 없으면 [])
async function listFaces(userId, conn = pool) {
  const [rows] = await conn.execute(
    `SELECT f.* FROM character_faces f
       JOIN character_profiles p ON p.id = f.profile_id AND p.is_main = 1
       JOIN characters c ON c.id = p.character_id
      WHERE c.user_id = ? ORDER BY f.seq`,
    [userId],
  );
  return rows.map(toFace);
}

// 채팅: 고른 두상이 내 캐릭터 것인지 → face id (비우면 null). 대표가 아닌 프로필의 두상도 허용 (예전 메시지 고칠 때)
async function ownFaceId(userId, faceId, conn = pool) {
  const id = Number(faceId) || 0;
  if (!id) return null;
  const [[row]] = await conn.execute(
    'SELECT f.id FROM character_faces f JOIN characters c ON c.id = f.character_id WHERE f.id = ? AND c.user_id = ?', [id, userId],
  );
  if (!row) throw new HttpError(400, '내 두상만 고를 수 있습니다. (지워졌을 수 있음 — 다시 골라주세요)');
  return row.id;
}

module.exports = { MAX_FACES, parseFaces, saveFaces, facesByProfile, listFaces, ownFaceId };
