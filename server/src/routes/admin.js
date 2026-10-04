// 관리자 전용: 캐릭터 스탯 / 프로필 양식으로 무엇을 수집할지(attribute_definitions) 관리
const express = require('express');
const pool = require('../db');
const requireAdmin = require('../middleware/requireAdmin');
const {
  VALUE_TYPES, HttpError, getDefinitions, groupDefinitions, withTransaction, getStatPoints, setStatPoints,
} = require('../characters');
const {
  getSetting, setSetting, parseSiteName, parseFavicon, getSiteSettings, clearSitePrivateCache,
} = require('../settings');
const { getCosts, saveCosts } = require('../costs');
const { parseYouTubeId } = require('../youtube');
const { listThemes, findTheme } = require('../themes');
const { parseIds, parseRows, pickFlags } = require('../bulk');

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

// 전역 설정: 초기 투자 포인트, 사이트 이름·파비콘, 사이트 전체 음악(유튜브 영상 ID)
async function currentSettings() {
  return {
    statPoints: await getStatPoints(),
    costs: await getCosts(),   // 코스트 1~5 [{ slot, name, enabled }]
    ...(await getSiteSettings()),
    signupNotice: (await getSetting('signup_notice')) || '',   // 회원가입 안내(주의문구, 마크다운)
    applicationNotice: (await getSetting('application_notice')) || '',   // 신청서 제출 동의사항(마크다운)
  };
}

// CSS 테마 목록 (client/public/css/<폴더>) + 지금 테마
router.get('/themes', async (req, res) => {
  res.json({ themes: listThemes(), active: (await getSiteSettings()).siteTheme.id });
});

router.get('/settings', async (req, res) => {
  res.json(await currentSettings());
});

// 보낸 값만 변경: { statPoints?, siteName?, siteFavicon?(업로드한 이미지 경로, 빈 값이면 없음), siteMusic?(유튜브 링크, 빈 값이면 끔), qnaGuestWrite?(Q&A 비회원 글쓰기 허용), sitePrivate?(회원 전용 — 로그인해야 이용), signupNotice?(회원가입 안내, 마크다운), siteTheme?(테마 폴더 이름), signupOpen?(회원가입 허용), siteClosed?, siteClosedMessage?(사이트 비공개·문구), applicationNotice?(신청서 제출 동의사항), profileAddOpen?, profileEditOpen?(프로필 추가/수정 허용), statsEnabled?(캐릭터 스탯 사용), costs?([{ name, enabled }] × 5 — 코스트 이름·사용) }
router.put('/settings', async (req, res) => {
  const body = req.body ?? {};
  // 검증을 먼저 모두 한 뒤 저장 (하나라도 틀리면 아무것도 바꾸지 않음)
  let statPoints;
  if (body.statPoints !== undefined) {
    statPoints = Number(body.statPoints);
    if (!Number.isInteger(statPoints) || statPoints < 0 || statPoints > 1000000) {
      throw new HttpError(400, '투자 포인트는 0 ~ 1,000,000 사이의 정수로 입력해주세요.');
    }
  }
  const siteName = body.siteName !== undefined ? parseSiteName(body.siteName) : undefined;
  const siteFavicon = body.siteFavicon !== undefined ? parseFavicon(body.siteFavicon) : undefined;
  const siteMusic = body.siteMusic !== undefined ? parseYouTubeId(body.siteMusic, '사이트 음악') : undefined;
  const qnaGuestWrite = body.qnaGuestWrite !== undefined ? !!body.qnaGuestWrite : undefined;
  const sitePrivate = body.sitePrivate !== undefined ? !!body.sitePrivate : undefined;
  const signupOpen = body.signupOpen !== undefined ? !!body.signupOpen : undefined;
  const siteClosed = body.siteClosed !== undefined ? !!body.siteClosed : undefined;
  let siteClosedMessage;
  if (body.siteClosedMessage !== undefined) {
    siteClosedMessage = String(body.siteClosedMessage ?? '').trim();
    if (siteClosedMessage.length > 5000) throw new HttpError(400, '비공개 안내 문구는 5,000자 이내로 입력해주세요.');
  }
  let applicationNotice;
  if (body.applicationNotice !== undefined) {
    applicationNotice = String(body.applicationNotice ?? '').trim();
    if (applicationNotice.length > 20000) throw new HttpError(400, '신청서 제출 동의사항은 20,000자 이내로 입력해주세요.');
  }
  const profileAddOpen = body.profileAddOpen !== undefined ? !!body.profileAddOpen : undefined;
  const profileEditOpen = body.profileEditOpen !== undefined ? !!body.profileEditOpen : undefined;
  const statsEnabled = body.statsEnabled !== undefined ? !!body.statsEnabled : undefined;
  let siteTheme;
  if (body.siteTheme !== undefined) {
    siteTheme = String(body.siteTheme ?? '');
    if (!findTheme(siteTheme)) throw new HttpError(400, '없는 테마입니다. (css 폴더에 style.css 가 있는지 확인)');
  }
  let signupNotice;
  if (body.signupNotice !== undefined) {
    signupNotice = String(body.signupNotice ?? '').trim();
    if (signupNotice.length > 20000) throw new HttpError(400, '회원가입 안내는 20,000자 이내로 입력해주세요.');
  }

  // 코스트는 검사에서 막힐 수 있으므로 먼저 저장
  if (body.costs !== undefined) await saveCosts(body.costs);
  if (statPoints !== undefined) await setStatPoints(statPoints);
  if (siteName !== undefined) await setSetting('site_name', siteName);
  if (siteFavicon !== undefined) await setSetting('site_favicon', siteFavicon);
  if (siteMusic !== undefined) await setSetting('site_music', siteMusic);
  if (qnaGuestWrite !== undefined) await setSetting('qna_guest_write', qnaGuestWrite ? '1' : '0');
  if (signupNotice !== undefined) await setSetting('signup_notice', signupNotice || null);
  if (siteTheme !== undefined) await setSetting('site_theme', siteTheme);
  if (signupOpen !== undefined) await setSetting('signup_open', signupOpen ? '1' : '0');
  if (siteClosedMessage !== undefined) await setSetting('site_closed_message', siteClosedMessage || null);
  if (applicationNotice !== undefined) await setSetting('application_notice', applicationNotice || null);
  if (siteClosed !== undefined) {
    await setSetting('site_closed', siteClosed ? '1' : '0');
    clearSitePrivateCache();
  }
  if (profileAddOpen !== undefined) await setSetting('profile_add_open', profileAddOpen ? '1' : '0');
  if (profileEditOpen !== undefined) await setSetting('profile_edit_open', profileEditOpen ? '1' : '0');
  if (statsEnabled !== undefined) await setSetting('stats_enabled', statsEnabled ? '1' : '0');
  if (sitePrivate !== undefined) {
    await setSetting('site_private', sitePrivate ? '1' : '0');
    clearSitePrivateCache();
  }
  res.json(await currentSettings());
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
// 항목 하나 수정 (conn: 트랜잭션 커넥션 또는 pool) — 단건/일괄 저장 공용
async function patchAttribute(conn, id, body = {}) {
  const [rows] = await conn.execute('SELECT value_type, options FROM attribute_definitions WHERE id = ?', [id]);
  if (!rows[0]) throw new HttpError(404, '항목을 찾을 수 없습니다.');

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
  await conn.execute(`UPDATE attribute_definitions SET ${updates.join(', ')} WHERE id = ?`, [...params, id]);
}

// ---------- 일괄 처리 (체크한 항목) — /:id 보다 먼저 등록 ----------
// 일괄 저장: { items: [{ id, label, valueType, options?, isRequired, sortOrder, isActive }] } — 하나라도 틀리면 전부 취소
router.put('/attributes/bulk', async (req, res) => {
  const items = parseRows(req.body?.items);
  await withTransaction(async (conn) => {
    for (const item of items) {
      try {
        await patchAttribute(conn, item.id, item);
      } catch (err) {
        if (err.expose) err.message = `[${String(item.label ?? '').trim() || `#${item.id}`}] ${err.message}`;
        throw err;
      }
    }
  });
  res.json({ updated: items.length });
});

// 사용/필수 일괄 변경: { ids, isActive?, isRequired? }
router.patch('/attributes/bulk', async (req, res) => {
  const ids = parseIds(req.body?.ids);
  const { sets, params } = pickFlags(req.body, { isActive: 'is_active', isRequired: 'is_required' });
  const [result] = await pool.query(`UPDATE attribute_definitions SET ${sets.join(', ')} WHERE id IN (?)`, [...params, ids]);
  res.json({ updated: result.affectedRows });
});

// 일괄 삭제: { ids } — 저장된 값도 함께 삭제
router.post('/attributes/bulk-delete', async (req, res) => {
  const ids = parseIds(req.body?.ids);
  const result = await withTransaction(async (conn) => {
    const [stats] = await conn.query('DELETE FROM character_stats WHERE definition_id IN (?)', [ids]);
    const [details] = await conn.query('DELETE FROM character_details WHERE definition_id IN (?)', [ids]);
    const [defs] = await conn.query('DELETE FROM attribute_definitions WHERE id IN (?)', [ids]);
    return { deleted: defs.affectedRows, deletedValues: stats.affectedRows + details.affectedRows };
  });
  res.json(result);
});

router.patch('/attributes/:id', async (req, res) => {
  await patchAttribute(pool, Number(req.params.id), req.body || {});
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
