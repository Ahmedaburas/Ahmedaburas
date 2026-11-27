import { defineEval } from "@grok/agent-sdk/evals";

export default defineEval({
  tags: ["smoke"],
  description: "Ops crew checks DARFIX API health with the health tool.",
  async test(t) {
    await t.send("Is the DARFIX API healthy? Use the darfix_health tool.");
    t.succeeded();
    t.calledTool("darfix_health");
  },
});
