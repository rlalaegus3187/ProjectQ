import { api } from './api';

// 이미지 업로드 (png/jpg/gif/webp, 5MB 이하) → 저장된 경로 반환 (/api/uploads/<랜덤>.png)
export async function uploadImage(file) {
  const body = new FormData();
  body.append('file', file);
  const { url } = await api('/uploads', { method: 'POST', body });
  return url;
}
