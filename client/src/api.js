// 모든 API 호출은 같은 도메인의 /api 로 보냄 → 세션 쿠키가 자동으로 함께 전송됨
// body 가 FormData 면(파일 업로드) 그대로, 아니면 JSON 으로 전송
export async function api(path, { method = 'GET', body } = {}) {
  const isForm = body instanceof FormData;
  const res = await fetch(`/api${path}`, {
    method,
    headers: body && !isForm ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? (isForm ? body : JSON.stringify(body)) : undefined,
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
