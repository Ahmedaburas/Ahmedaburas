import { defineTool } from "@grok/agent-sdk/tools";
import * as z from "zod/v4";

export default defineTool({
  description: "Return a structured outline template for a Dev.Ag UX/FE/BE gap report.",
  effect: "read",
  inputSchema: z.object({
    focus: z
      .enum(["all", "customer", "provider", "technician", "admin", "security-ux"])
      .optional(),
  }),
  async execute({ focus }) {
    return {
      ok: true as const,
      focus: focus || "all",
      sections: [
        "Executive summary",
        "Surfaces reviewed (customer / provider / tech / admin / API)",
        "P0 blockers",
        "P1 friction",
        "P2 polish",
        "Fixes landed this pass",
        "Deferred / needs product decision",
        "Suggested next sprint",
      ],
      scoringHint: "P0 blocks completing a core job; P1 causes confusion or dead ends; P2 polish.",
    };
  },
});
