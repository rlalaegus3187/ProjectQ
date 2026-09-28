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

// 회원가입 + 캐릭터 등록을 한 번에: { name, email, password, character: { name, hp, stats, details } }
export async function signup(payload) {
  const { user } = await api('/auth/signup', { method: 'POST', body: payload });
  auth.user = user;
}

export const isAdmin = () => auth.user?.role === 'admin';

export async function logout() {
  await api('/auth/logout', { method: 'POST' });
  auth.user = null;
}
