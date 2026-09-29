// 공개 설정 (로그인 없이) — 사이트 이름·아이콘, 사이트 전체 음악
const express = require('express');
const { getSiteSettings } = require('../settings');

const router = express.Router();

router.get('/', async (req, res) => {
  res.json(await getSiteSettings());
});

module.exports = router;
