// 메시지 종류(type)별 화면 — 서버 모듈이 만든 type 을 어떻게 그릴지
//   client/src/chat/modules/*.js 를 자동으로 불러옴. 각 파일: export default { name, messageTypes: { 종류: 컴포넌트 } }
//   등록 안 된 종류는 기본 모양(본문 글자)으로 보임 → 화면 모듈이 없어도 서버 모듈만으로 동작
const files = import.meta.glob('./modules/*.js', { eager: true });
const types = {};
for (const [path, mod] of Object.entries(files)) {
  if (path.split('/').pop().startsWith('_')) continue;
  Object.assign(types, mod.default?.messageTypes || {});
}

export const messageComponent = (type) => types[type] || null;
