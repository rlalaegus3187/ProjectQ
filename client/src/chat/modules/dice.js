// 주사위 모듈 화면 — 서버 server/src/chat/modules/dice.js 가 만든 type 'dice' 메시지를 주사위 모양으로
import DiceMessage from './DiceMessage.vue';

export default {
  name: 'dice',
  messageTypes: { dice: DiceMessage },
};
