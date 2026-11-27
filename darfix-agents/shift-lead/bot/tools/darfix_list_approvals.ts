import { defineTool } from "@grok/agent-sdk/tools";
import * as z from "zod/v4";
import { listApprovals } from "../lib/approvalsApi";

type ApprovalRow = {
  id: string
  action: string
  bookingId: string | null
  rationale: string
  proposedBy: string
  status: string
}

export default defineTool({
  description: "List pending (or decided) sensitive-action approvals for the shift lead.",
  effect: "read",
  inputSchema: z.object({
    status: z.enum(["pending", "approved", "rejected"]).optional().default("pending"),
  }),
  async execute({ status }) {
    const data = await listApprovals(status ?? "pending");
    const approvals: ApprovalRow[] = ((data.approvals || []) as ApprovalRow[]).map((a) => ({
      id: String(a.id),
      action: String(a.action),
      bookingId: a.bookingId ? String(a.bookingId) : null,
      rationale: String(a.rationale || ""),
      proposedBy: String(a.proposedBy || ""),
      status: String(a.status || ""),
    }));
    return { ok: true as const, count: approvals.length, approvals };
  },
});
