// 멤버란: 전체 캐릭터 목록 / 캐릭터 상세 (보기 전용, 로그인 없이 공개)
// 계정 정보(이메일 등)와 인벤토리는 공개하지 않음
// 로그인한 회원만 보게 하려면: router.use(require('../middleware/requireAuth'));
const express = require('express');
const pool = require('../db');
const { HttpError, getCharacter } = require('../characters');

const router = express.Router();
const PAGE_SIZE = 24;

// 목록: 캐릭터 이름 검색 + 페이지
// thumbnail = 대표 프로필에서 첫 번째(정렬 순서) 이미지 항목 값 (대표 프로필은 캐릭터 이름으로 표시)
router.get('/', async (req, res) => {
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const q = String(req.query.q ?? '').trim();
  const where = q ? 'WHERE c.name LIKE ?' : '';
  const params = q ? [`%${q}%`] : [];

  const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM characters c ${where}`, params);
  const [rows] = await pool.query(
    `SELECT c.id, c.name, c.created_at,
            (SELECT d.value
               FROM character_details d
               JOIN attribute_definitions ad ON ad.id = d.definition_id
              WHERE d.profile_id = p.id AND ad.value_type = 'image' AND ad.is_active = 1
              ORDER BY ad.sort_order, ad.id LIMIT 1) AS thumbnail,
            (SELECT COUNT(*) FROM character_profiles cp WHERE cp.character_id = c.id) AS profile_count
       FROM characters c
       LEFT JOIN character_profiles p ON p.character_id = c.id AND p.is_main = 1
       ${where}
      ORDER BY c.id DESC
      LIMIT ? OFFSET ?`,
    [...params, PAGE_SIZE, (page - 1) * PAGE_SIZE],
  );

  res.json({
    members: rows.map((r) => ({
      id: r.id,
      name: r.name,
      thumbnail: r.thumbnail,
      profileCount: Number(r.profile_count),
      createdAt: r.created_at,
    })),
    page,
    pageSize: PAGE_SIZE,
    total: Number(total),
  });
});

// 상세: 기본정보 + 스탯 + 프로필 (보기 전용)
router.get('/:id', async (req, res) => {
  if (!/^\d+$/.test(req.params.id)) throw new HttpError(404, '캐릭터를 찾을 수 없습니다.');
  const character = await getCharacter({ characterId: req.params.id });
  if (!character) throw new HttpError(404, '캐릭터를 찾을 수 없습니다.');
  delete character.money;   // 소지금은 공개하지 않음
  res.json({ character });
});

module.exports = router;
