import { defineConnection } from "@grok/agent-sdk/connections";

export default defineConnection({
  agent: "customer-support",
  description:
    "Delegate customer status and ETA questions to Customer Support. Sensitive commitments need approval.",
});
