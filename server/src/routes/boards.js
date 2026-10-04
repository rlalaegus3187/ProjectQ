// 게시판: Q&A (회원·비회원 질문, 관리자 답변, 비밀글, 메인 글)
// (공지/세계관/시스템/캐릭터 가이드는 게시판이 아닌 콘텐츠 페이지 — routes/contents.js)
//
// 비회원 글 (관리 → 사이트 설정에서 허용했을 때만 새로 쓸 수 있음)
//   이름 + 비밀번호 필수. 비밀번호로 수정·삭제하고, 비밀글이면 비밀번호로 봄
// 글 비밀번호: 비회원 글은 필수, 회원 비밀글은 선택 (작성자·관리자 말고도 비밀번호를 아는 사람이 볼 수 있게)
//   비밀번호를 맞히면 이 브라우저 세션에 기록 → 그 글을 보기(비밀글) / 수정·삭제(비회원 글) 가능
// 관리자만 쓰는 게시판이 필요하면 BOARDS 에 { label, adminOnly: true } 로 추가
const express = require('express');
const pool = require('../db');
const rateLimit = require('express-rate-limit');
const loadViewer = require('../middleware/loadViewer');
const { HttpError, withTransaction } = require('../characters');
const { notify } = require('../notify');
const { hashPassword, verifyPassword } = require('../password');
const { isGuestWriteAllowed } = require('../settings');

const router = express.Router();
router.use(loadViewer);

const BOARDS = {
  qna: { label: 'Q&A', adminOnly: false },
};
const PAGE_SIZE = 20;
const MAX_TITLE = 200;
const MAX_BODY = 50000;
const MAX_GUEST_NAME = 20;
const PASSWORD_MIN = 4;
const PASSWORD_MAX = 50;
const MAX_VERIFIED = 50;   // 세션에 기억할 '비밀번호 확인한 글' 수

const limiter = (limit, message) => rateLimit({
  windowMs: 15 * 60 * 1000, limit, standardHeaders: 'draft-8', legacyHeaders: false, message: { message },
});
// 비회원 도배 방지: IP 당 15분에 5개
const guestPostLimiter = limiter(5, '글을 너무 많이 올렸습니다. 잠시 후 다시 시도해주세요.');
// 비밀번호 맞히기 방지: IP 당 15분에 20회
const verifyLimiter = limiter(20, '비밀번호 확인을 너무 많이 시도했습니다. 잠시 후 다시 시도해주세요.');

function getBoard(req) {
  const board = BOARDS[req.params.board];
  if (!board) throw new HttpError(404, '없는 게시판입니다.');
  return { key: req.params.board, ...board };
}

function requireLogin(req) {
  if (!req.viewer) throw new HttpError(401, '로그인이 필요합니다.');
}

function requireAdmin(req) {
  requireLogin(req);
  if (!req.viewer.isAdmin) throw new HttpError(403, '관리자만 사용할 수 있습니다.');
}

// 이 세션에서 비밀번호를 확인한 글 id 목록
const verifiedIds = (req) => new Set(req.session.verifiedPosts || []);
function markVerified(req, postId) {
  const ids = (req.session.verifiedPosts || []).filter((id) => id !== postId);
  req.session.verifiedPosts = [...ids, postId].slice(-MAX_VERIFIED);
}

const isAuthor = (post, viewer) => !!viewer && post.user_id !== null && viewer.id === post.user_id;
// verified: 이 세션에서 글 비밀번호를 확인했는지
const isVerified = (post, verified) => !!post.password_hash && verified.has(post.id);
// 비밀글: 작성자, 관리자, 비밀번호를 확인한 사람만
const canView = (post, viewer, verified) => !post.is_hidden || !!viewer?.isAdmin || isAuthor(post, viewer) || isVerified(post, verified);
// 수정/삭제: 관리자 전용 게시판은 관리자만. Q&A 는 관리자, 회원 글은 작성자, 비회원 글은 비밀번호를 확인한 사람
const canEdit = (board, post, viewer, verified) => !!viewer?.isAdmin || (!board.adminOnly
  && (isAuthor(post, viewer) || (post.user_id === null && isVerified(post, verified))));

function parsePassword(value, { required }) {
  const password = String(value ?? '');
  if (!password) {
    if (required) throw new HttpError(400, '비밀번호를 입력해주세요.');
    return null;
  }
  if (password.length < PASSWORD_MIN || password.length > PASSWORD_MAX) {
    throw new HttpError(400, `비밀번호는 ${PASSWORD_MIN}~${PASSWORD_MAX}자로 입력해주세요.`);
  }
  return password;
}

// 글 비밀번호 결정 → 저장할 해시 (undefined = 그대로 둠, null = 없앰)
//   guest: 비회원 글 / existing: 수정할 때 기존 글
async function resolvePassword(body, { guest, existing, isHidden }) {
  if (guest) {
    // 비회원 글: 새 글은 필수, 수정 때 비우면 그대로
    const password = parsePassword(body?.password, { required: !existing });
    return password ? hashPassword(password) : undefined;
  }
  // 회원 글: 비밀글일 때만 선택으로 사용
  if (!isHidden || body?.removePassword) return existing?.password_hash ? null : undefined;
  const password = parsePassword(body?.password, { required: false });
  return password ? hashPassword(password) : undefined;
}

function parsePostInput(body, board) {
  const title = String(body?.title ?? '').trim();
  const text = String(body?.body ?? '').trim();
  if (!title || title.length > MAX_TITLE) throw new HttpError(400, `제목은 1~${MAX_TITLE}자로 입력해주세요.`);
  if (!text) throw new HttpError(400, '내용을 입력해주세요.');
  if (text.length > MAX_BODY) throw new HttpError(400, `내용은 ${MAX_BODY.toLocaleString()}자 이내로 입력해주세요.`);
  // 비밀글은 Q&A 에서만
  const isHidden = board.key === 'qna' && !!body?.isHidden;
  return { title, body: text, isHidden };
}

function toListItem(row, viewer, verified) {
  const visible = canView(row, viewer, verified);
  return {
    id: row.id,
    title: visible ? row.title : '비밀글입니다.',
    author: row.author ?? row.guest_name,
    isGuest: row.user_id === null,
    hasPassword: !visible && !!row.password_hash,   // 잠긴 글인데 비밀번호로 열 수 있는지
    isHidden: !!row.is_hidden,
    isPinned: !!row.is_pinned,
    locked: !visible,
    replyCount: Number(row.reply_count),
    createdAt: row.created_at,
  };
}

async function findPost(boardKey, id) {
  const [rows] = await pool.execute(
    `SELECT p.id, p.board, p.user_id, p.guest_name, p.password_hash, p.title, p.body, p.is_hidden, p.is_pinned,
            p.created_at, p.updated_at, u.username AS author
       FROM posts p LEFT JOIN users u ON u.id = p.user_id
      WHERE p.board = ? AND p.id = ?`,
    [boardKey, Number(id)],
  );
  if (!rows[0]) throw new HttpError(404, '글을 찾을 수 없습니다.');
  return rows[0];
}

const LIST_COLUMNS = `p.id, p.user_id, p.guest_name, p.password_hash, p.title, p.is_hidden, p.is_pinned, p.created_at, u.username AS author,
  (SELECT COUNT(*) FROM post_replies r WHERE r.post_id = p.id) AS reply_count`;

// 글쓰기 가능 여부: { canWrite, guestWrite(비회원으로 쓰는지) }
async function writeAccess(board, viewer) {
  if (board.adminOnly) return { canWrite: !!viewer?.isAdmin, guestWrite: false };
  if (viewer) return { canWrite: true, guestWrite: false };
  const allowed = board.key === 'qna' && await isGuestWriteAllowed();
  return { canWrite: allowed, guestWrite: allowed };
}

// 글쓰기 화면용: 지금 쓸 수 있는지
router.get('/:board/write-access', async (req, res) => {
  res.json(await writeAccess(getBoard(req), req.viewer));
});

// 목록: Q&A 는 메인 글(pinned)을 따로 상단에, 나머지는 페이지로
router.get('/:board/posts', async (req, res) => {
  const board = getBoard(req);
  const verified = verifiedIds(req);
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const pinnedFilter = board.key === 'qna' ? 'AND p.is_pinned = 0' : '';

  const [[{ total }]] = await pool.query(
    `SELECT COUNT(*) AS total FROM posts p WHERE p.board = ? ${pinnedFilter}`,
    [board.key],
  );
  const [rows] = await pool.query(
    `SELECT ${LIST_COLUMNS} FROM posts p LEFT JOIN users u ON u.id = p.user_id
      WHERE p.board = ? ${pinnedFilter}
      ORDER BY p.id DESC LIMIT ? OFFSET ?`,
    [board.key, PAGE_SIZE, (page - 1) * PAGE_SIZE],
  );
  let pinned = [];
  if (board.key === 'qna') {
    const [pinnedRows] = await pool.query(
      `SELECT ${LIST_COLUMNS} FROM posts p LEFT JOIN users u ON u.id = p.user_id
        WHERE p.board = 'qna' AND p.is_pinned = 1 ORDER BY p.id DESC`,
    );
    pinned = pinnedRows.map((r) => toListItem(r, req.viewer, verified));
  }

  res.json({
    board: { key: board.key, label: board.label, adminOnly: board.adminOnly },
    pinned,
    posts: rows.map((r) => toListItem(r, req.viewer, verified)),
    page,
    pageSize: PAGE_SIZE,
    total: Number(total),
    ...(await writeAccess(board, req.viewer)),
  });
});

// 상세 (+ Q&A 답변)
router.get('/:board/posts/:id', async (req, res) => {
  const board = getBoard(req);
  const post = await findPost(board.key, req.params.id);
  const verified = verifiedIds(req);
  if (!canView(post, req.viewer, verified)) {
    // 비밀번호가 걸린 글이면 화면에서 비밀번호를 입력받음
    const hasPassword = !!post.password_hash;
    throw new HttpError(
      hasPassword || req.viewer ? 403 : 401,
      hasPassword ? '비밀글입니다. 비밀번호를 입력해주세요.' : '비밀글입니다. 작성자와 관리자만 볼 수 있습니다.',
      { locked: true, hasPassword },
    );
  }
  let replies = [];
  if (board.key === 'qna') {
    const [rows] = await pool.execute(
      `SELECT r.id, r.body, r.created_at, r.updated_at, u.username AS author
         FROM post_replies r JOIN users u ON u.id = r.user_id
        WHERE r.post_id = ? ORDER BY r.id`,
      [post.id],
    );
    replies = rows.map((r) => ({ id: r.id, body: r.body, author: r.author, createdAt: r.created_at, updatedAt: r.updated_at }));
  }
  res.json({
    post: {
      id: post.id,
      board: post.board,
      title: post.title,
      body: post.body,
      author: post.author ?? post.guest_name,
      isGuest: post.user_id === null,
      isHidden: !!post.is_hidden,
      isPinned: !!post.is_pinned,
      hasPassword: !!post.password_hash,
      createdAt: post.created_at,
      updatedAt: post.updated_at,
      canEdit: canEdit(board, post, req.viewer, verified),
      // 비회원 글: 비밀번호를 확인하면 수정·삭제 가능
      canVerify: post.user_id === null && !canEdit(board, post, req.viewer, verified),
    },
    replies,
    canReply: board.key === 'qna' && !!req.viewer?.isAdmin,
    canPin: board.key === 'qna' && !!req.viewer?.isAdmin,
  });
});

// 글쓰기 — 회원, 또는 (허용된 경우) 비회원 { title, body, isHidden, password?, guestName?(비회원) }
router.post('/:board/posts', (req, res, next) => (req.viewer ? next() : guestPostLimiter(req, res, next)), async (req, res) => {
  const board = getBoard(req);
  if (board.adminOnly) requireAdmin(req);
  const guest = !req.viewer;
  if (guest && !(await writeAccess(board, null)).canWrite) {
    throw new HttpError(401, '로그인이 필요합니다. (비회원 글쓰기가 꺼져 있습니다)');
  }
  const data = parsePostInput(req.body, board);
  let guestName = null;
  if (guest) {
    guestName = String(req.body?.guestName ?? '').trim();
    if (!guestName || guestName.length > MAX_GUEST_NAME) throw new HttpError(400, `이름은 1~${MAX_GUEST_NAME}자로 입력해주세요.`);
  }
  const passwordHash = (await resolvePassword(req.body, { guest, isHidden: data.isHidden })) ?? null;

  const [result] = await pool.execute(
    'INSERT INTO posts (board, user_id, guest_name, title, body, is_hidden, password_hash) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [board.key, req.viewer?.id ?? null, guestName, data.title, data.body, data.isHidden ? 1 : 0, passwordHash],
  );
  // 비회원 작성자는 방금 쓴 글을 바로 볼 수 있게 (이 브라우저에서)
  if (guest) markVerified(req, result.insertId);
  res.status(201).json({ id: result.insertId });
});

// 글 비밀번호 확인 { password } → 이 세션에서 그 글 보기(비밀글) / 수정·삭제(비회원 글) 가능
router.post('/:board/posts/:id/verify', verifyLimiter, async (req, res) => {
  const board = getBoard(req);
  const post = await findPost(board.key, req.params.id);
  if (!post.password_hash) throw new HttpError(400, '비밀번호가 없는 글입니다.');
  if (!(await verifyPassword(String(req.body?.password ?? ''), post.password_hash))) {
    throw new HttpError(403, '비밀번호가 올바르지 않습니다.');
  }
  markVerified(req, post.id);
  res.status(204).end();
});

// 수정
// { title, body, isHidden, password?(비우면 그대로), removePassword?(회원 비밀글 비밀번호 없애기) }
router.put('/:board/posts/:id', async (req, res) => {
  const board = getBoard(req);
  const post = await findPost(board.key, req.params.id);
  if (!canEdit(board, post, req.viewer, verifiedIds(req))) throw new HttpError(req.viewer ? 403 : 401, '수정할 권한이 없습니다.');
  const data = parsePostInput(req.body, board);
  const passwordHash = await resolvePassword(req.body, { guest: post.user_id === null, existing: post, isHidden: data.isHidden });
  await pool.execute(
    'UPDATE posts SET title = ?, body = ?, is_hidden = ?, password_hash = ? WHERE id = ?',
    [data.title, data.body, data.isHidden ? 1 : 0, passwordHash === undefined ? post.password_hash : passwordHash, post.id],
  );
  res.status(204).end();
});

// 삭제 (답변·관련 알림도 함께 삭제됨: FK CASCADE)
router.delete('/:board/posts/:id', async (req, res) => {
  const board = getBoard(req);
  const post = await findPost(board.key, req.params.id);
  if (!canEdit(board, post, req.viewer, verifiedIds(req))) throw new HttpError(req.viewer ? 403 : 401, '삭제할 권한이 없습니다.');
  await pool.execute('DELETE FROM posts WHERE id = ?', [post.id]);
  res.status(204).end();
});

// Q&A 메인 글 지정/해제 (관리자)
router.put('/qna/posts/:id/pin', async (req, res) => {
  requireAdmin(req);
  const post = await findPost('qna', req.params.id);
  // updated_at 을 그대로 지정해서 메인 글 지정이 '수정됨'으로 표시되지 않게 함
  await pool.execute('UPDATE posts SET is_pinned = ?, updated_at = updated_at WHERE id = ?', [req.body?.isPinned ? 1 : 0, post.id]);
  res.status(204).end();
});

function parseReply(body) {
  const text = String(body?.body ?? '').trim();
  if (!text) throw new HttpError(400, '답변 내용을 입력해주세요.');
  if (text.length > MAX_BODY) throw new HttpError(400, `답변은 ${MAX_BODY.toLocaleString()}자 이내로 입력해주세요.`);
  return text;
}

// Q&A 답변 등록 (관리자) → 질문 작성자에게 알림
router.post('/qna/posts/:id/replies', async (req, res) => {
  requireAdmin(req);
  const post = await findPost('qna', req.params.id);
  const text = parseReply(req.body);
  const replyId = await withTransaction(async (conn) => {
    const [result] = await conn.execute(
      'INSERT INTO post_replies (post_id, user_id, body) VALUES (?, ?, ?)',
      [post.id, req.viewer.id, text],
    );
    // 비회원 글은 알림을 받을 계정이 없음
    if (post.user_id !== null && post.user_id !== req.viewer.id) {
      const title = post.title.length > 40 ? `${post.title.slice(0, 40)}…` : post.title;
      await notify({
        userId: post.user_id,
        type: 'qna_reply',
        postId: post.id,
        message: `Q&A 질문 '${title}'에 답변이 달렸습니다.`,
      }, conn);
    }
    return result.insertId;
  });
  res.status(201).json({ id: replyId });
});

// 답변 수정 / 삭제 (관리자)
router.put('/qna/replies/:replyId', async (req, res) => {
  requireAdmin(req);
  const [result] = await pool.execute('UPDATE post_replies SET body = ? WHERE id = ?', [parseReply(req.body), Number(req.params.replyId)]);
  if (!result.affectedRows) throw new HttpError(404, '답변을 찾을 수 없습니다.');
  res.status(204).end();
});

router.delete('/qna/replies/:replyId', async (req, res) => {
  requireAdmin(req);
  const [result] = await pool.execute('DELETE FROM post_replies WHERE id = ?', [Number(req.params.replyId)]);
  if (!result.affectedRows) throw new HttpError(404, '답변을 찾을 수 없습니다.');
  res.status(204).end();
});

module.exports = router;
