function baseUrl() {
  return (process.env.DARFIX_API_URL || "http://127.0.0.1:8787").replace(/\/$/, "");
}

function adminCreds() {
  const email = process.env.DARFIX_ADMIN_EMAIL?.trim();
  const password = process.env.DARFIX_ADMIN_PASSWORD;
  if (!email || !password) {
    throw new Error("Set DARFIX_ADMIN_EMAIL and DARFIX_ADMIN_PASSWORD for Dev.Ag.");
  }
  return { email, password };
}

async function request<T>(path: string, init: RequestInit & { token?: string } = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  if (init.token) headers.set("Authorization", `Bearer ${init.token}`);
  const res = await fetch(`${baseUrl()}${path}`, { ...init, headers });
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    const err = data as { error?: string };
    throw new Error(err?.error || `DARFIX API ${res.status} on ${path}`);
  }
  return data as T;
}

export async function loginAdmin() {
  const account = adminCreds();
  return request<{ token: string }>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(account),
  });
}

export async function getHealth() {
  return request<{ ok: boolean; service: string }>("/api/health");
}

export async function getUxAudit(token: string) {
  return request<Record<string, unknown>>("/api/dev/ux-audit", { token });
}

export { baseUrl };
