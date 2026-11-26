/**
 * Thin HTTP client for the DARFIX Express API (Security Guardian).
 * Credentials: DARFIX_ADMIN_EMAIL + DARFIX_ADMIN_PASSWORD (never hardcode).
 */

function baseUrl() {
  return (process.env.DARFIX_API_URL || "http://127.0.0.1:8787").replace(/\/$/, "");
}

function adminCreds() {
  const email = process.env.DARFIX_ADMIN_EMAIL?.trim();
  const password = process.env.DARFIX_ADMIN_PASSWORD;
  if (!email || !password) {
    throw new Error(
      "Set DARFIX_ADMIN_EMAIL and DARFIX_ADMIN_PASSWORD for Security Guardian (no hardcoded demo passwords).",
    );
  }
  return { email, password };
}

async function request<T>(
  path: string,
  init: RequestInit & { token?: string } = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
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
  return request<{ token: string; user: { id: string; role: string; name: string; email: string } }>(
    "/api/auth/login",
    { method: "POST", body: JSON.stringify(account) },
  );
}

export async function getHealth() {
  return request<{ ok: boolean; service: string }>("/api/health");
}

export async function getPlaybook(token: string) {
  return request<Record<string, unknown>>("/api/security/playbook", { token });
}

export async function runAudit(token: string, notify = true) {
  return request<{
    ok: boolean;
    playbookVersion: string;
    auditedAt: string;
    findingCount: number;
    alertCount: number;
    findings: Array<Record<string, unknown>>;
  }>("/api/security/audit", {
    method: "POST",
    token,
    body: JSON.stringify({ notify }),
  });
}

export async function listFindings(token: string, status = "open") {
  return request<{ findings: Array<Record<string, unknown>> }>(
    `/api/security/findings?status=${encodeURIComponent(status)}`,
    { token },
  );
}

export async function proposeRemediation(token: string, findingCode: string, rationale: string) {
  return request<{ approval: Record<string, unknown> }>("/api/security/remediate/propose", {
    method: "POST",
    token,
    body: JSON.stringify({ findingCode, rationale }),
  });
}

export async function listApprovals(token: string, status = "pending") {
  return request<{ approvals: Array<Record<string, unknown>> }>(
    `/api/agent/approvals?status=${encodeURIComponent(status)}`,
    { token },
  );
}

export async function decideApproval(token: string, id: string, approve: boolean, note?: string) {
  return request<{ approval: Record<string, unknown> }>(`/api/agent/approvals/${id}/decide`, {
    method: "POST",
    token,
    body: JSON.stringify({ approve, note }),
  });
}

export { baseUrl };
