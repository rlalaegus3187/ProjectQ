<script setup>
import { auth } from '../auth';
</script>

<template>
  <section class="card">
    <h1>마이페이지</h1>
    <p>로그인한 사용자만 볼 수 있는 페이지입니다.</p>
    <ul>
      <li>이름: {{ auth.user.name }}</li>
      <li>이메일: {{ auth.user.email }}</li>
      <li>가입일: {{ new Date(auth.user.createdAt).toLocaleDateString() }}</li>
    </ul>
  </section>
</template>
