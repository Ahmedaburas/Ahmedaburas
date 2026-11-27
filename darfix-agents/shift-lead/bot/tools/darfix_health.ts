import { defineTool } from "@grok/agent-sdk/tools";
import * as z from "zod/v4";
import { baseUrl, getHealth } from "../lib/darfixApi";

export default defineTool({
  description: "Check whether the DARFIX API is reachable and healthy.",
  effect: "read",
  inputSchema: z.object({}),
  async execute() {
    try {
      const health = await getHealth();
      return { ok: true as const, baseUrl: baseUrl(), health };
    } catch (e) {
      return {
        ok: false as const,
        baseUrl: baseUrl(),
        error: e instanceof Error ? e.message : String(e),
      };
    }
  },
});
