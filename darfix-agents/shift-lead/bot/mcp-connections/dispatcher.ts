import { defineConnection } from "@grok/agent-sdk/connections";

export default defineConnection({
  agent: "dispatcher",
  description:
    "Delegate confirm/assign work to the Dispatcher peer (queue, confirm, first-time assign).",
});
