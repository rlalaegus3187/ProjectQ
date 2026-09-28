// 관리자: 신청자 관리 — 신청자(applicant) 캐릭터 목록/보기, 체크한 캐릭터 한꺼번에 멤버 전환 / 삭제
const express = require('express');
const pool = require('../db');
const requireAdmin = require('../middleware/requireAdmin');
const { HttpError, getCharacter, withTransaction } = require('../characters');
const { notifyUsers } = require('../notify');

const router = express.Router();
router.use(requireAdmin);

const MAX_BULK = 500;

// 체크한 캐릭터 id 목록: { characterIds: [1, 2, ...] }
function parseIds(body) {
  const raw = body?.characterIds;
  if (!Array.isArray(raw) || !raw.length) throw new HttpError(400, '캐릭터를 선택해주세요.');
  if (raw.length > MAX_BULK) throw new HttpError(400, `한 번에 ${MAX_BULK}개까지 처리할 수 있습니다.`);
  const ids = [...new Set(raw.map(Number))];
  if (ids.some((id) => !Number.isInteger(id) || id <= 0)) throw new HttpError(400, '잘못된 캐릭터 id 가 있습니다.');
  return ids;
}

// 선택한 것 중 신청자 캐릭터만 (잠금) — 이미 멤버가 된 캐릭터는 건드리지 않음
async function lockApplicants(conn, ids) {
  const [rows] = await conn.query(
    `SELECT c.id, c.name, c.user_id
       FROM characters c JOIN users u ON u.id = c.user_id
      WHERE c.id IN (?) AND u.role = 'applicant'
      FOR UPDATE`,
    [ids],
  );
  return rows;
}

// 목록: ?status=draft|submitted (없으면 전체), ?q= 캐릭터 이름/회원 이름/이메일
router.get('/applicants', async (req, res) => {
  const status = ['draft', 'submitted'].includes(req.query.status) ? req.query.status : null;
  const q = String(req.query.q ?? '').trim();
  const conditions = ["u.role = 'applicant'"];
  const params = [];
  if (status) { conditions.push('c.application_status = ?'); params.push(status); }
  if (q) { conditions.push('(c.name LIKE ? OR u.name LIKE ? OR u.email LIKE ?)'); params.push(`%${q}%`, `%${q}%`, `%${q}%`); }

  const [rows] = await pool.query(
    `SELECT c.id, c.name, c.application_status, c.submitted_at, c.created_at, c.updated_at,
            u.id AS user_id, u.name AS user_name, u.email,
            (SELECT d.value
               FROM character_details d
               JOIN attribute_definitions ad ON ad.id = d.definition_id
              WHERE d.profile_id = p.id AND ad.value_type = 'image' AND ad.is_active = 1
              ORDER BY ad.sort_order, ad.id LIMIT 1) AS thumbnail
       FROM characters c
       JOIN users u ON u.id = c.user_id
       LEFT JOIN character_profiles p ON p.character_id = c.id AND p.is_main = 1
      WHERE ${conditions.join(' AND ')}
      ORDER BY c.application_status = 'submitted' DESC, c.submitted_at, c.id`,
    params,
  );
  const [[counts]] = await pool.query(
    `SELECT COUNT(*) AS total, COALESCE(SUM(c.application_status = 'submitted'), 0) AS submitted
       FROM characters c JOIN users u ON u.id = c.user_id WHERE u.role = 'applicant'`,
  );
  // 캐릭터 없이 가입만 한 신청자 (삭제된 뒤 다시 작성하지 않은 경우 포함)
  const [[{ noCharacter }]] = await pool.query(
    `SELECT COUNT(*) AS noCharacter FROM users u
      WHERE u.role = 'applicant' AND NOT EXISTS (SELECT 1 FROM characters c WHERE c.user_id = u.id)`,
  );

  res.json({
    applicants: rows.map((r) => ({
      id: r.id,
      name: r.name,
      thumbnail: r.thumbnail,
      applicationStatus: r.application_status,
      submittedAt: r.submitted_at,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      user: { id: r.user_id, name: r.user_name, email: r.email },
    })),
    counts: {
      total: Number(counts.total),
      submitted: Number(counts.submitted),
      draft: Number(counts.total) - Number(counts.submitted),
      noCharacter: Number(noCharacter),
    },
  });
});

// 신청자 캐릭터 1개 보기 (기본정보 + 스탯 + 프로필)
router.get('/applicants/:id', async (req, res) => {
  if (!/^\d+$/.test(req.params.id)) throw new HttpError(404, '캐릭터를 찾을 수 없습니다.');
  const character = await getCharacter({ characterId: req.params.id });
  if (!character || character.ownerRole !== 'applicant') throw new HttpError(404, '신청자 캐릭터를 찾을 수 없습니다.');
  res.json({ character });
});

// 체크한 신청자 → 멤버로 전환. 신청 프로필이 그대로 대표 프로필이 됨
router.post('/applicants/accept', async (req, res) => {
  const ids = parseIds(req.body);
  const accepted = await withTransaction(async (conn) => {
    const rows = await lockApplicants(conn, ids);
    if (!rows.length) return [];
    const characterIds = rows.map((r) => r.id);
    await conn.query("UPDATE users SET role = 'member' WHERE id IN (?) AND role = 'applicant'", [rows.map((r) => r.user_id)]);
    // 신청자는 프로필이 1개 → 그 프로필을 대표 프로필로 (혹시 여러 개면 가장 먼저 만든 것)
    for (const id of characterIds) {
      await conn.execute(
        `UPDATE character_profiles p
           JOIN (SELECT id FROM character_profiles WHERE character_id = ? ORDER BY is_main DESC, sort_order, id LIMIT 1) m
           SET p.is_main = (p.id = m.id)
         WHERE p.character_id = ?`,
        [id, id],
      );
    }
    await conn.query("UPDATE characters SET application_status = 'submitted' WHERE id IN (?)", [characterIds]);
    await notifyUsers(rows.map((r) => r.user_id), {
      type: 'application', message: '축하합니다! 신청이 승인되어 멤버가 되었습니다.', link: '/mypage',
    }, conn);
    return rows;
  });
  res.json({ accepted: accepted.map((r) => ({ id: r.id, name: r.name })), skipped: ids.length - accepted.length });
});

// 체크한 신청자 캐릭터 삭제 (캐릭터 + 프로필 전부). 계정은 남아서 다시 작성해 신청할 수 있음
router.post('/applicants/delete', async (req, res) => {
  const ids = parseIds(req.body);
  const deleted = await withTransaction(async (conn) => {
    const rows = await lockApplicants(conn, ids);
    if (!rows.length) return [];
    await conn.query('DELETE FROM characters WHERE id IN (?)', [rows.map((r) => r.id)]);
    return rows;
  });
  res.json({ deleted: deleted.map((r) => ({ id: r.id, name: r.name })), skipped: ids.length - deleted.length });
});

module.exports = router;
