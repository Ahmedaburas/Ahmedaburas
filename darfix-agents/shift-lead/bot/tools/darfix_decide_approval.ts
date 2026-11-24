import { defineTool } from "@grok/agent-sdk/tools";
import * as z from "zod/v4";
import { decideApproval } from "../lib/approvalsApi";

export default defineTool({
  description:
    "Approve or reject a sensitive agent proposal (cancel, reassign, or customer commitment). Shift lead only.",
  effect: "write",
  inputSchema: z.object({
    approvalId: z.string(),
    approve: z.boolean(),
    note: z.string().optional(),
  }),
  async execute({ approvalId, approve, note }) {
    const data = await decideApproval(approvalId, approve, note);
    const a = (data.approval || {}) as {
      id?: string
      status?: string
      decidedBy?: string
      decisionNote?: string | null
      decidedAt?: string
      applied?: { bookingId?: string; status?: string; technicianId?: string } | null
    };
    return {
      ok: true as const,
      id: String(a.id || approvalId),
      status: String(a.status || ""),
      decidedBy: String(a.decidedBy || ""),
      decisionNote: a.decisionNote ? String(a.decisionNote) : null,
      decidedAt: a.decidedAt ? String(a.decidedAt) : null,
      appliedBookingId: a.applied?.bookingId ? String(a.applied.bookingId) : null,
      appliedStatus: a.applied?.status ? String(a.applied.status) : null,
    };
  },
});
