import { defineTool } from "@grok/agent-sdk/tools";
import * as z from "zod/v4";
import { getUxAudit, loginAdmin } from "../lib/darfixApi";

export default defineTool({
  description:
    "Run the DARFIX UX/product audit endpoint (admin). Returns checklist scores and known gap signals.",
  effect: "read",
  inputSchema: z.object({}),
  async execute() {
    const { token } = await loginAdmin();
    const audit = await getUxAudit(token);
    return { ok: true as const, audit };
  },
});
