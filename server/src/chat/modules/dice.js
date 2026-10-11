// 예시 모듈: 주사위 — /주사위 2d6, /주사위 (기본 1d6), /dice 3d10+2
// 결과는 type 'dice' 메시지로 저장되고, 화면은 client/src/chat/modules/dice.js 가 주사위 모양으로 그림
const MAX_DICE = 20;
const MAX_SIDES = 1000;

module.exports = {
  name: 'dice',
  description: '주사위 굴리기',
  setup(chat) {
    chat.command('주사위', { aliases: ['dice', 'roll'], usage: '/주사위 2d6+1', description: '주사위 굴리기 (개수d면수+보정)' }, ({ argText }) => {
      const m = (argText || '1d6').replace(/\s+/g, '').match(/^(\d{0,2})d(\d{1,4})([+-]\d{1,4})?$/i);
      if (!m) throw new chat.HttpError(400, '형식: /주사위 2d6, /주사위 1d20+3');
      const count = Number(m[1] || 1);
      const sides = Number(m[2]);
      const bonus = Number(m[3] || 0);
      if (count < 1 || count > MAX_DICE || sides < 2 || sides > MAX_SIDES) {
        throw new chat.HttpError(400, `주사위는 1~${MAX_DICE}개, 면은 2~${MAX_SIDES}까지입니다.`);
      }
      const rolls = Array.from({ length: count }, () => 1 + Math.floor(Math.random() * sides));
      const total = rolls.reduce((a, b) => a + b, 0) + bonus;
      const expr = `${count}d${sides}${bonus ? (bonus > 0 ? `+${bonus}` : bonus) : ''}`;
      // body: 모듈 화면이 없는 곳(예: 알림)에서도 읽히는 글, data: 화면이 쓰는 값
      return { type: 'dice', body: `🎲 ${expr} → ${total} (${rolls.join(', ')})`, data: { expr, rolls, bonus, total } };
    });
  },
};
