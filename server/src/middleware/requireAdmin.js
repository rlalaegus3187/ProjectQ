const pool = require('../db');

// 권한은 매 요청마다 DB 에서 확인 (권한 변경이 즉시 반영되도록)
module.exports = async function requireAdmin(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ message: '로그인이 필요합니다.' });
  }
  const [rows] = await pool.execute('SELECT role FROM users WHERE id = ?', [req.session.userId]);
  if (rows[0]?.role !== 'admin') {
    return res.status(403).json({ message: '관리자만 사용할 수 있습니다.' });
  }
  next();
};
