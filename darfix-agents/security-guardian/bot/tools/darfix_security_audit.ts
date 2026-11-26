import { defineTool } from "@grok/agent-sdk/tools";
import * as z from "zod/v4";
import { loginAdmin, runAudit } from "../lib/darfixApi";

export default defineTool({
  description:
    "Run a full security audit (frontend/backend/agents/data signals). Notifies admins on critical/high by default.",
  effect: "write",
  inputSchema: z.object({
    notify: z
      .boolean()
      .optional()
      .describe("Notify admins on critical/high findings (default true)"),
  }),
  async execute({ notify }) {
    const { token } = await loginAdmin();
    const result = await runAudit(token, notify !== false);
    return {
      ok: true as const,
      playbookVersion: result.playbookVersion,
      auditedAt: result.auditedAt,
      findingCount: result.findingCount,
      alertCount: result.alertCount,
      findings: result.findings.map((f) => ({
        code: f.code,
        severity: f.severity,
        title: f.title,
        surface: f.surface,
        autoFixable: f.autoFixable,
        recommendedAction: f.recommendedAction,
      })),
    };
  },
});
