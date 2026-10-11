<script setup>
// type 'dice' 메시지: data = { expr, rolls, bonus, total }
defineProps({ message: { type: Object, required: true } });
</script>

<template>
  <div class="chat-dice">
    <span class="chat-dice-expr">🎲 {{ message.data.expr }}</span>
    <span class="chat-dice-rolls">
      <span v-for="(r, i) in message.data.rolls" :key="i" class="chat-die">{{ r }}</span>
      <span v-if="message.data.bonus" class="muted">{{ message.data.bonus > 0 ? '+' : '' }}{{ message.data.bonus }}</span>
    </span>
    <strong class="chat-dice-total">= {{ message.data.total }}</strong>
  </div>
</template>
