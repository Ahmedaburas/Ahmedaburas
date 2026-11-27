import { defineTool } from "@grok/agent-sdk/tools";
import * as z from "zod/v4";
import { listApprovals, loginAdmin } from "../lib/darfixApi";

export default defineTool({
  description: "List agent/security approval requests (admin). Prefer proposing remediations over deciding them.",
  effect: "read",
  inputSchema: z.object({
    status: z.enum(["pending", "approved", "rejected"]).optional(),
  }),
  async execute({ status }) {
    const { token } = await loginAdmin();
    const data = await listApprovals(token, status || "pending");
    return { ok: true as const, count: data.approvals.length, approvals: data.approvals };
  },
});
