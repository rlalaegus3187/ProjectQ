// 게시판: 공지 / 세계관 / 캐릭터 가이드 (관리자 작성) + Q&A (회원 질문, 관리자 답변, 비밀글, 메인 글)
const express = require('express');
const pool = require('../db');
const loadViewer = require('../middleware/loadViewer');
const { HttpError, withTransaction } = require('../characters');
const { notify } = require('../notify');

const router = express.Router();
router.use(loadViewer);

const BOARDS = {
  notice: { label: '공지', adminOnly: true },
  world: { label: '세계관', adminOnly: true },
  guide: { label: '캐릭터 가이드', adminOnly: true },
  qna: { label: 'Q&A', adminOnly: false },
};
const PAGE_SIZE = 20;
const MAX_TITLE = 200;
const MAX_BODY = 50000;

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

// 비밀글은 작성자와 관리자만 볼 수 있음
const canView = (post, viewer) => !post.is_hidden || (viewer && (viewer.isAdmin || viewer.id === post.user_id));
// 수정/삭제: 관리자 전용 게시판은 관리자만, Q&A 는 작성자 또는 관리자
const canEdit = (board, post, viewer) => !!viewer && (viewer.isAdmin || (!board.adminOnly && viewer.id === post.user_id));

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

function toListItem(row, viewer) {
  const visible = canView(row, viewer);
  return {
    id: row.id,
    title: visible ? row.title : '비밀글입니다.',
    author: row.author,
    isHidden: !!row.is_hidden,
    isPinned: !!row.is_pinned,
    locked: !visible,
    replyCount: Number(row.reply_count),
    createdAt: row.created_at,
  };
}

async function findPost(boardKey, id) {
  const [rows] = await pool.execute(
    `SELECT p.id, p.board, p.user_id, p.title, p.body, p.is_hidden, p.is_pinned, p.created_at, p.updated_at, u.name AS author
       FROM posts p JOIN users u ON u.id = p.user_id
      WHERE p.board = ? AND p.id = ?`,
    [boardKey, Number(id)],
  );
  if (!rows[0]) throw new HttpError(404, '글을 찾을 수 없습니다.');
  return rows[0];
}

const LIST_COLUMNS = `p.id, p.user_id, p.title, p.is_hidden, p.is_pinned, p.created_at, u.name AS author,
  (SELECT COUNT(*) FROM post_replies r WHERE r.post_id = p.id) AS reply_count`;

// 목록: Q&A 는 메인 글(pinned)을 따로 상단에, 나머지는 페이지로
router.get('/:board/posts', async (req, res) => {
  const board = getBoard(req);
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const pinnedFilter = board.key === 'qna' ? 'AND p.is_pinned = 0' : '';

  const [[{ total }]] = await pool.query(
    `SELECT COUNT(*) AS total FROM posts p WHERE p.board = ? ${pinnedFilter}`,
    [board.key],
  );
  const [rows] = await pool.query(
    `SELECT ${LIST_COLUMNS} FROM posts p JOIN users u ON u.id = p.user_id
      WHERE p.board = ? ${pinnedFilter}
      ORDER BY p.id DESC LIMIT ? OFFSET ?`,
    [board.key, PAGE_SIZE, (page - 1) * PAGE_SIZE],
  );
  let pinned = [];
  if (board.key === 'qna') {
    const [pinnedRows] = await pool.query(
      `SELECT ${LIST_COLUMNS} FROM posts p JOIN users u ON u.id = p.user_id
        WHERE p.board = 'qna' AND p.is_pinned = 1 ORDER BY p.id DESC`,
    );
    pinned = pinnedRows.map((r) => toListItem(r, req.viewer));
  }

  res.json({
    board: { key: board.key, label: board.label, adminOnly: board.adminOnly },
    pinned,
    posts: rows.map((r) => toListItem(r, req.viewer)),
    page,
    pageSize: PAGE_SIZE,
    total: Number(total),
    canWrite: board.adminOnly ? !!req.viewer?.isAdmin : !!req.viewer,
  });
});

// 상세 (+ Q&A 답변)
router.get('/:board/posts/:id', async (req, res) => {
  const board = getBoard(req);
  const post = await findPost(board.key, req.params.id);
  if (!canView(post, req.viewer)) {
    throw new HttpError(req.viewer ? 403 : 401, '비밀글입니다. 작성자와 관리자만 볼 수 있습니다.');
  }
  let replies = [];
  if (board.key === 'qna') {
    const [rows] = await pool.execute(
      `SELECT r.id, r.body, r.created_at, r.updated_at, u.name AS author
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
      author: post.author,
      isHidden: !!post.is_hidden,
      isPinned: !!post.is_pinned,
      createdAt: post.created_at,
      updatedAt: post.updated_at,
      canEdit: canEdit(board, post, req.viewer),
    },
    replies,
    canReply: board.key === 'qna' && !!req.viewer?.isAdmin,
    canPin: board.key === 'qna' && !!req.viewer?.isAdmin,
  });
});

// 글쓰기
router.post('/:board/posts', async (req, res) => {
  const board = getBoard(req);
  if (board.adminOnly) requireAdmin(req); else requireLogin(req);
  const data = parsePostInput(req.body, board);
  const [result] = await pool.execute(
    'INSERT INTO posts (board, user_id, title, body, is_hidden) VALUES (?, ?, ?, ?, ?)',
    [board.key, req.viewer.id, data.title, data.body, data.isHidden ? 1 : 0],
  );
  res.status(201).json({ id: result.insertId });
});

// 수정
router.put('/:board/posts/:id', async (req, res) => {
  const board = getBoard(req);
  requireLogin(req);
  const post = await findPost(board.key, req.params.id);
  if (!canEdit(board, post, req.viewer)) throw new HttpError(403, '수정할 권한이 없습니다.');
  const data = parsePostInput(req.body, board);
  await pool.execute(
    'UPDATE posts SET title = ?, body = ?, is_hidden = ? WHERE id = ?',
    [data.title, data.body, data.isHidden ? 1 : 0, post.id],
  );
  res.status(204).end();
});

// 삭제 (답변·관련 알림도 함께 삭제됨: FK CASCADE)
router.delete('/:board/posts/:id', async (req, res) => {
  const board = getBoard(req);
  requireLogin(req);
  const post = await findPost(board.key, req.params.id);
  if (!canEdit(board, post, req.viewer)) throw new HttpError(403, '삭제할 권한이 없습니다.');
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
    if (post.user_id !== req.viewer.id) {
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
