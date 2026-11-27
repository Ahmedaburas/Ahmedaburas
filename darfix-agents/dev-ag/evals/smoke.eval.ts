import { defineEval } from "@grok/agent-sdk/evals";

export default defineEval({
  tags: ["smoke"],
  description: "Dev.Ag checks API health.",
  async test(t) {
    await t.send("Is the DARFIX API healthy? Use darfix_health.");
    t.succeeded();
    t.calledTool("darfix_health");
  },
});
