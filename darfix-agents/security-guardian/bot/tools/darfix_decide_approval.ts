import { defineTool } from "@grok/agent-sdk/tools";
import * as z from "zod/v4";
import { decideApproval, loginAdmin } from "../lib/darfixApi";

export default defineTool({
  description:
    "Decide a pending approval ONLY when the human operator explicitly asked you to approve/reject. Never auto-approve remediations.",
  effect: "write",
  inputSchema: z.object({
    approvalId: z.string(),
    approve: z.boolean(),
    note: z.string().optional(),
  }),
  async execute({ approvalId, approve, note }) {
    const { token } = await loginAdmin();
    const data = await decideApproval(token, approvalId, approve, note);
    return { ok: true as const, approval: data.approval };
  },
});
