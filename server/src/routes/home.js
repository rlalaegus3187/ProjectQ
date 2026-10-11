// 메인페이지
//   공개:   GET /api/home                         켜진 모듈(순서대로) + 모듈 데이터(배너, 캘린더: 저번달~다음달 이벤트)
//           GET /api/home/events?month=YYYY-MM    그 달 캘린더 이벤트 (메인 달력을 더 넘길 때)
//   관리자: GET/PUT /api/admin/home/modules       메인페이지 설정 [{ key, visible }] (순서 = 화면 순서)
//           GET/POST /api/admin/home/banners      배너 목록 / 추가 { image, title, link, sortOrder }
//           PUT/DELETE /api/admin/home/banners/:id
//           GET /api/admin/home/calendar          이벤트 전체
//           POST /api/admin/home/events           이벤트 추가 { title, description, color, startDate, endDate }
//           PUT/DELETE /api/admin/home/events/:id
const express = require('express');
const pool = require('../db');
const requireAdmin = require('../middleware/requireAdmin');
const { HttpError } = require('../errors');
const home = require('../home');

const publicRouter = express.Router();
publicRouter.get('/', async (req, res) => {
  res.json(await home.homeData());
});
publicRouter.get('/events', async (req, res) => {
  res.json({ events: await home.listEvents(home.monthRange(req.query.month)) });
});

const adminRouter = express.Router();
adminRouter.use('/home', requireAdmin);

adminRouter.get('/home/modules', async (req, res) => res.json({ modules: await home.getModules() }));
adminRouter.put('/home/modules', async (req, res) => {
  await home.saveModules(req.body?.modules);
  res.json({ modules: await home.getModules() });
});

// 배너
const sendBanners = async (res, status = 200) => res.status(status).json({ banners: await home.listBanners() });
adminRouter.get('/home/banners', (req, res) => sendBanners(res));
adminRouter.post('/home/banners', async (req, res) => {
  const b = home.parseBanner(req.body);
  await pool.execute('INSERT INTO home_banners (image, title, link, sort_order) VALUES (?, ?, ?, ?)', [b.image, b.title, b.link, b.sortOrder]);
  await sendBanners(res, 201);
});
adminRouter.put('/home/banners/:id', async (req, res) => {
  const b = home.parseBanner(req.body);
  const [r] = await pool.execute('UPDATE home_banners SET image = ?, title = ?, link = ?, sort_order = ? WHERE id = ?',
    [b.image, b.title, b.link, b.sortOrder, Number(req.params.id) || 0]);
  if (!r.affectedRows) throw new HttpError(404, '배너를 찾을 수 없습니다.');
  await sendBanners(res);
});
adminRouter.delete('/home/banners/:id', async (req, res) => {
  const [r] = await pool.execute('DELETE FROM home_banners WHERE id = ?', [Number(req.params.id) || 0]);
  if (!r.affectedRows) throw new HttpError(404, '배너를 찾을 수 없습니다.');
  await sendBanners(res);
});

// 캘린더
const sendCalendar = async (res, status = 200) => res.status(status).json({ events: await home.listEvents() });
adminRouter.get('/home/calendar', (req, res) => sendCalendar(res));
adminRouter.post('/home/events', async (req, res) => {
  const e = home.parseEvent(req.body);
  await pool.execute('INSERT INTO home_events (title, description, color, start_date, end_date) VALUES (?, ?, ?, ?, ?)',
    [e.title, e.description, e.color, e.startDate, e.endDate]);
  await sendCalendar(res, 201);
});
adminRouter.put('/home/events/:id', async (req, res) => {
  const e = home.parseEvent(req.body);
  const [r] = await pool.execute('UPDATE home_events SET title = ?, description = ?, color = ?, start_date = ?, end_date = ? WHERE id = ?',
    [e.title, e.description, e.color, e.startDate, e.endDate, Number(req.params.id) || 0]);
  if (!r.affectedRows) throw new HttpError(404, '이벤트를 찾을 수 없습니다.');
  await sendCalendar(res);
});
adminRouter.delete('/home/events/:id', async (req, res) => {
  const [r] = await pool.execute('DELETE FROM home_events WHERE id = ?', [Number(req.params.id) || 0]);
  if (!r.affectedRows) throw new HttpError(404, '이벤트를 찾을 수 없습니다.');
  await sendCalendar(res);
});

module.exports = { publicRouter, adminRouter };
