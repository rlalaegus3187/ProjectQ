// 이미지 업로드: POST /api/uploads (multipart, 필드명 file) → { url: "/api/uploads/<파일명>" }
// 회원가입 폼에서도 이미지를 올릴 수 있어야 해서 로그인 없이 허용하되, IP 당 횟수·크기를 제한
const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');
const express = require('express');
const multer = require('multer');
const rateLimit = require('express-rate-limit');
const config = require('../config');
const { HttpError } = require('../characters');

const router = express.Router();
const MAX_SIZE = 5 * 1024 * 1024;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_SIZE, files: 1 },
});

const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { message: '업로드가 너무 많습니다. 잠시 후 다시 시도해주세요.' },
});

// 파일 확장자/Content-Type 은 조작할 수 있으므로 실제 파일 앞부분(시그니처)으로 형식 판별
// (SVG 는 스크립트를 담을 수 있어 허용하지 않음)
function detectImageType(buf) {
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg';
  if (buf.length >= 6 && ['GIF87a', 'GIF89a'].includes(buf.subarray(0, 6).toString('latin1'))) return 'gif';
  if (buf.length >= 12 && buf.subarray(0, 4).toString('latin1') === 'RIFF' && buf.subarray(8, 12).toString('latin1') === 'WEBP') return 'webp';
  return null;
}

router.post('/', uploadLimiter, upload.single('file'), async (req, res) => {
  if (!req.file) throw new HttpError(400, '업로드할 파일이 없습니다.');
  const ext = detectImageType(req.file.buffer);
  if (!ext) throw new HttpError(400, '이미지 파일(png, jpg, gif, webp)만 올릴 수 있습니다.');

  const name = `${crypto.randomBytes(16).toString('hex')}.${ext}`;
  await fs.mkdir(config.uploadDir, { recursive: true });
  await fs.writeFile(path.join(config.uploadDir, name), req.file.buffer, { flag: 'wx' });
  res.status(201).json({ url: `/api/uploads/${name}` });
});

// 업로드된 파일 제공 (파일명이 랜덤이라 내용이 바뀌지 않으므로 오래 캐시)
router.use(express.static(config.uploadDir, { index: false, dotfiles: 'deny', maxAge: '30d', immutable: true }));

module.exports = router;
