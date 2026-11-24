import { defineConnection } from "@grok/agent-sdk/connections";

export default defineConnection({
  agent: "ops-analyst",
  description:
    "Delegate KPI / morning briefing / backlog analysis to the Operations Analyst peer.",
});
