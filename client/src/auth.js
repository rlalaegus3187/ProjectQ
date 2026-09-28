import { reactive } from 'vue';
import { api } from './api';

// 앱 전체에서 공유하는 로그인 상태
export const auth = reactive({
  user: null,
  loaded: false,
});

// 새로고침 시 서버 세션으로 로그인 상태 복원 (최초 1회)
export async function loadUser() {
  if (auth.loaded) return auth.user;
  try {
    const { user } = await api('/auth/me');
    auth.user = user;
  } catch {
    auth.user = null;
  }
  auth.loaded = true;
  return auth.user;
}

export async function login(email, password) {
  const { user } = await api('/auth/login', { method: 'POST', body: { email, password } });
  auth.user = user;
}

export async function signup(name, email, password) {
  const { user } = await api('/auth/signup', { method: 'POST', body: { name, email, password } });
  auth.user = user;
}

export async function logout() {
  await api('/auth/logout', { method: 'POST' });
  auth.user = null;
}
