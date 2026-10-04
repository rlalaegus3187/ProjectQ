// CSS 테마 — client/public/css/<폴더>/ 를 테마 목록으로 보여주고, 고른 테마를 settings.site_theme 에 저장
//
//   css/basic/style.css     기본 테마 (index.html 에서 항상 먼저 불러옴)
//   css/<테마>/style.css    고른 테마 — basic 다음에 불러와서 덮어씀 (필수)
//   css/<테마>/theme.json   { "name": "표시 이름", "description": "설명", "author": "만든 사람" } (선택)
//   css/<테마>/preview.png  관리 화면 미리보기 그림 (선택, png/jpg/webp)
//
// 폴더 이름: 영문 소문자·숫자·-·_ (예: theme1, dark-blue). 배포하면 웹 루트의 /css/<테마>/ 로 그대로 올라감
const fs = require('fs');
const path = require('path');
const config = require('./config');
const { getSetting } = require('./settings');

const DIR_RE = /^[a-z0-9][a-z0-9_-]{0,39}$/;
const BASIC = 'basic';
const PREVIEWS = ['preview.png', 'preview.jpg', 'preview.webp'];

function readMeta(dir) {
  try {
    const meta = JSON.parse(fs.readFileSync(path.join(dir, 'theme.json'), 'utf8'));
    const text = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
    return { name: text(meta.name, 50), description: text(meta.description, 300), author: text(meta.author, 50) };
  } catch {
    return { name: '', description: '', author: '' };
  }
}

// 테마 목록 (basic 이 맨 앞). style.css 가 없는 폴더는 테마가 아님
function listThemes() {
  let entries = [];
  try {
    entries = fs.readdirSync(config.themesDir, { withFileTypes: true });
  } catch {
    return [{ id: BASIC, name: '기본', description: '', author: '', css: null, preview: null }];
  }
  const themes = [];
  for (const e of entries) {
    if (!e.isDirectory() || !DIR_RE.test(e.name)) continue;
    const dir = path.join(config.themesDir, e.name);
    let stat;
    try { stat = fs.statSync(path.join(dir, 'style.css')); } catch { continue; }
    const meta = readMeta(dir);
    const preview = PREVIEWS.find((f) => fs.existsSync(path.join(dir, f)));
    themes.push({
      id: e.name,
      name: meta.name || (e.name === BASIC ? '기본' : e.name),
      description: meta.description,
      author: meta.author,
      // basic 은 index.html 이 항상 불러오므로 따로 붙이지 않음. ?v= 는 파일을 고치면 바뀜 (브라우저 캐시 갱신)
      css: e.name === BASIC ? null : `/css/${e.name}/style.css?v=${Math.floor(stat.mtimeMs)}`,
      preview: preview ? `/css/${e.name}/${preview}?v=${Math.floor(stat.mtimeMs)}` : null,
    });
  }
  themes.sort((a, b) => (a.id === BASIC ? -1 : b.id === BASIC ? 1 : a.id.localeCompare(b.id)));
  if (!themes.some((t) => t.id === BASIC)) themes.unshift({ id: BASIC, name: '기본', description: '', author: '', css: null, preview: null });
  return themes;
}

const findTheme = (id) => listThemes().find((t) => t.id === id) || null;

// 지금 적용된 테마 { id, css } — 저장된 테마 폴더가 없어졌으면 basic
async function getActiveTheme(conn) {
  const id = (await getSetting('site_theme', conn)) || BASIC;
  const theme = findTheme(id) || findTheme(BASIC);
  return { id: theme.id, css: theme.css };
}

module.exports = { BASIC, listThemes, findTheme, getActiveTheme };
