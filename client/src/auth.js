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

// 아이디 + 비밀번호로 로그인
export async function login(username, password) {
  const { user } = await api('/auth/login', { method: 'POST', body: { username, password } });
  auth.user = user;
}

// 회원가입: { username, password, contact(소통 계정), agree(가입 안내 동의) } — 캐릭터는 가입 후 마이페이지에서
export async function signup(payload) {
  const { user } = await api('/auth/signup', { method: 'POST', body: payload });
  auth.user = user;
}

// 소통 계정 수정 (아이디는 바꿀 수 없음)
export async function updateContact(contact) {
  const { user } = await api('/auth/me', { method: 'PUT', body: { contact } });
  auth.user = user;
}

// 내가 동의한 회원가입 안내 { agreedAt, notice } / 동의 기록이 없으면 지금 안내에 동의
export const fetchAgreement = () => api('/auth/me/agreement');
export async function agreeNotice() {
  const { user } = await api('/auth/me/agreement', { method: 'PUT', body: { agree: true } });
  auth.user = user;
}

// 계정 삭제 (되돌릴 수 없음) → 로그아웃 상태가 됨
export async function deleteAccount(password) {
  await api('/auth/me', { method: 'DELETE', body: { password, confirm: true } });
  auth.user = null;
}

// 비밀번호 변경 → 다른 기기의 로그인은 끊김
export async function changePassword(currentPassword, newPassword) {
  await api('/auth/me/password', { method: 'PUT', body: { currentPassword, newPassword } });
}

export const isAdmin = () => auth.user?.role === 'admin';

// 권한: admin 관리자 / member 멤버 / applicant 신청자 (가입 기본값)
export const ROLE_LABELS = { admin: '관리자', member: '멤버', applicant: '신청자' };
export const roleLabel = (role) => ROLE_LABELS[role] ?? role;

// 신청서 상태 (신청자)
export const APPLICATION_LABELS = { draft: '작성중', submitted: '작성완료' };

export async function logout() {
  await api('/auth/logout', { method: 'POST' });
  auth.user = null;
}
