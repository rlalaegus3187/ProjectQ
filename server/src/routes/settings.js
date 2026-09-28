// 공개 설정 (로그인 없이) — 사이트 전체 음악 등
const express = require('express');
const { getSetting } = require('../settings');

const router = express.Router();

router.get('/', async (req, res) => {
  res.json({ siteMusic: await getSetting('site_music') });
});

module.exports = router;
