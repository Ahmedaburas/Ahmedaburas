import { defineTool } from "@grok/agent-sdk/tools";
import * as z from "zod/v4";
import { baseUrl, loginAs } from "../lib/darfixApi";

/**
 * Fetches draft campaign suggestions from the DARFIX API (provider-authenticated).
 * Never publishes ads — read-only drafts with requiresApproval flags.
 */
export default defineTool({
  description:
    "Load seasonal Saudi campaign draft suggestions from DARFIX (approval required before any paid publish).",
  effect: "read",
  inputSchema: z.object({
    role: z.enum(["admin"]).optional().default("admin"),
  }),
  async execute() {
    try {
      // Admin can call campaigns endpoint; if forbidden, return static calendar.
      const { token } = await loginAs("admin");
      const res = await fetch(`${baseUrl()}/api/org/campaigns/suggestions`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = (await res.json()) as {
          suggestions: unknown[];
          note?: string;
        };
        return {
          ok: true as const,
          source: "api",
          suggestions: data.suggestions,
          note: data.note,
        };
      }
    } catch {
      // fall through to static
    }

    const year = new Date().getFullYear();
    return {
      ok: true as const,
      source: "static",
      note: "Drafts only — never auto-publish paid ads without approval.",
      suggestions: [
        {
          id: "ramadan",
          titleEn: "Ramadan evening service window",
          window: `${year}-02 — ${year}-03`,
          requiresApproval: true,
        },
        {
          id: "summer-ac",
          titleEn: "Summer AC peak",
          window: `${year}-05 — ${year}-09`,
          requiresApproval: true,
        },
        {
          id: "national-day",
          titleEn: "Saudi National Day",
          window: `${year}-09-23`,
          requiresApproval: true,
        },
        {
          id: "white-friday",
          titleEn: "White Friday",
          window: `${year}-11`,
          requiresApproval: true,
        },
      ],
    };
  },
});
