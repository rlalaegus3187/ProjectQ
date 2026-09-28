import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  server: {
    // 개발 중(npm run dev)에는 /api 요청을 로컬 Express 로 전달 (운영에서는 Nginx 가 담당)
    proxy: { '/api': 'http://127.0.0.1:3000' },
  },
});
