import { loginAs } from "./darfixApi";

type ApprovalAction = "cancel_booking" | "reassign_technician" | "customer_commitment";

export async function proposeApproval(input: {
  action: ApprovalAction
  bookingId?: string
  payload?: Record<string, string | number | boolean | null>
  rationale: string
  proposedBy: string
}) {
  const { token } = await loginAs("admin");
  const res = await fetch(
    `${(process.env.DARFIX_API_URL || "http://127.0.0.1:8787").replace(/\/$/, "")}/api/agent/approvals`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(input),
    },
  );
  const data = (await res.json()) as { error?: string; approval?: Record<string, unknown> };
  if (!res.ok) throw new Error(data.error || `propose failed (${res.status})`);
  return data;
}

export async function listApprovals(status: "pending" | "approved" | "rejected" = "pending") {
  const { token } = await loginAs("admin");
  const res = await fetch(
    `${(process.env.DARFIX_API_URL || "http://127.0.0.1:8787").replace(/\/$/, "")}/api/agent/approvals?status=${status}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  const data = (await res.json()) as { error?: string; approvals?: unknown[] };
  if (!res.ok) throw new Error(data.error || `list failed (${res.status})`);
  return data;
}

export async function decideApproval(id: string, approve: boolean, note?: string) {
  const { token } = await loginAs("admin");
  const res = await fetch(
    `${(process.env.DARFIX_API_URL || "http://127.0.0.1:8787").replace(/\/$/, "")}/api/agent/approvals/${id}/decide`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ approve, note }),
    },
  );
  const data = (await res.json()) as { error?: string; approval?: Record<string, unknown> };
  if (!res.ok) throw new Error(data.error || `decide failed (${res.status})`);
  return data;
}
