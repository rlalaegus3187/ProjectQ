import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  // 화면별 css(/css/basic/admin.css, pages/*.css) 주소 뒤 ?v= — 빌드할 때마다 바뀜 (client/src/pageCss.js)
  define: { __CSS_VERSION__: JSON.stringify(String(Date.now())) },
  server: {
    // 개발 중(npm run dev)에는 /api 요청을 로컬 Express 로 전달 (운영에서는 Nginx 가 담당)
    proxy: { '/api': 'http://127.0.0.1:3000' },
  },
});
