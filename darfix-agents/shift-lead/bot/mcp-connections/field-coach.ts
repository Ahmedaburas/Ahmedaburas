import { defineConnection } from "@grok/agent-sdk/connections";

export default defineConnection({
  agent: "field-coach",
  description:
    "Delegate technician field updates (status, notes, checklist) to the Field Coach peer.",
});
