import { defineTool } from "@grok/agent-sdk/tools";
import * as z from "zod/v4";
import { loginAdmin, proposeRemediation } from "../lib/darfixApi";

export default defineTool({
  description:
    "Propose a security remediation for human approval. Never applies the fix itself — waits for admin decide.",
  effect: "write",
  inputSchema: z.object({
    findingCode: z.string(),
    rationale: z.string(),
  }),
  async execute({ findingCode, rationale }) {
    const { token } = await loginAdmin();
    const data = await proposeRemediation(token, findingCode, rationale);
    const a = data.approval || {};
    return {
      ok: true as const,
      approvalId: String(a.id || ""),
      action: String(a.action || "security_remediation"),
      status: String(a.status || "pending"),
      findingCode,
      note: "Human approval required before corrective action runs.",
    };
  },
});
