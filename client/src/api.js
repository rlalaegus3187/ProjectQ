// 모든 API 호출은 같은 도메인의 /api 로 보냄 → 세션 쿠키가 자동으로 함께 전송됨
export async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(`/api${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'same-origin',
  });
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) {
    const error = new Error(data?.message || `요청 실패 (${res.status})`);
    error.status = res.status;
    throw error;
  }
  return data;
}
