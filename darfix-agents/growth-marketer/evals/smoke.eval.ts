import { defineEval } from "@grok/agent-sdk/evals";

export default defineEval({
  tags: ["smoke"],
  description: "Growth marketer checks API health.",
  async test(t) {
    await t.send("Is the DARFIX API healthy? Use the darfix_health tool.");
    t.succeeded();
    t.calledTool("darfix_health");
  },
});
