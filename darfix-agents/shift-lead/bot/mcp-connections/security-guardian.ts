import { defineConnection } from "@grok/agent-sdk/connections";

export default defineConnection({
  agent: "security-guardian",
  description:
    "Delegate continuous security audits, threat notifications, and approval-gated remediations to the Security Guardian peer.",
});
