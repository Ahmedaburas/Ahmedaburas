import { defineTool } from "@grok/agent-sdk/tools";
import * as z from "zod/v4";
import { proposeApproval } from "../lib/approvalsApi";

export default defineTool({
  description:
    "Propose a sensitive action for shift-lead approval: cancel_booking, reassign_technician, or customer_commitment.",
  effect: "write",
  inputSchema: z.object({
    action: z.enum(["cancel_booking", "reassign_technician", "customer_commitment"]),
    bookingId: z.string().optional(),
    technicianId: z.string().optional().describe("Required for reassign_technician"),
    message: z.string().optional().describe("Commitment text for customer_commitment"),
    rationale: z.string(),
    proposedBy: z.string().describe("Agent role name proposing this action"),
  }),
  async execute({ action, bookingId, technicianId, message, rationale, proposedBy }) {
    const payload: Record<string, string | null> = {};
    if (technicianId) payload.technicianId = technicianId;
    if (message) payload.message = message;
    const data = await proposeApproval({
      action,
      bookingId,
      payload,
      rationale,
      proposedBy,
    });
    const a = (data.approval || {}) as { id?: string; status?: string; action?: string };
    return {
      ok: true as const,
      approvalId: String(a.id || ""),
      action: String(a.action || action),
      status: String(a.status || "pending"),
      bookingId: bookingId ? String(bookingId) : null,
    };
  },
});
