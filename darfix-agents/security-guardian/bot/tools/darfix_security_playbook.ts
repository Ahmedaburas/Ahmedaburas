import { defineTool } from "@grok/agent-sdk/tools";
import * as z from "zod/v4";
import { getPlaybook, loginAdmin } from "../lib/darfixApi";

export default defineTool({
  description:
    "Fetch the current DARFIX security playbook (versioned checklist). Call this first so the guardian auto-updates its guidance.",
  effect: "read",
  inputSchema: z.object({}),
  async execute() {
    const { token } = await loginAdmin();
    const playbook = await getPlaybook(token);
    return {
      ok: true as const,
      version: String(playbook.version || ""),
      updatedAt: String(playbook.updatedAt || ""),
      checklistCount: Array.isArray(playbook.checklist) ? playbook.checklist.length : 0,
      principles: playbook.principles,
      checklist: playbook.checklist,
    };
  },
});
