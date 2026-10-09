const pool = require('../db');

// 로그인 여부와 무관하게 쓰는 API 에서 현재 사용자 정보를 붙임
// req.viewer = { id, username, role, isAdmin } 또는 null
module.exports = async function loadViewer(req, res, next) {
  req.viewer = null;
  if (req.session.userId) {
    const [rows] = await pool.execute('SELECT id, username, role FROM users WHERE id = ?', [req.session.userId]);
    if (rows[0]) req.viewer = { id: rows[0].id, username: rows[0].username, role: rows[0].role, isAdmin: rows[0].role === 'admin' };
  }
  next();
};
