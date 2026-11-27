import { defineTool } from "@grok/agent-sdk/tools";
import * as z from "zod/v4";
import { listFindings, loginAdmin } from "../lib/darfixApi";

export default defineTool({
  description: "List persisted security findings (open / acknowledged / resolved).",
  effect: "read",
  inputSchema: z.object({
    status: z.enum(["open", "acknowledged", "resolved"]).optional(),
  }),
  async execute({ status }) {
    const { token } = await loginAdmin();
    const data = await listFindings(token, status || "open");
    return {
      ok: true as const,
      count: data.findings.length,
      findings: data.findings,
    };
  },
});
