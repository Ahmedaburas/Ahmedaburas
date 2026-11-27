import { defineEval } from "@grok/agent-sdk/evals";

export default defineEval({
  tags: ["dispatch"],
  description: "Shift lead inspects the dispatch queue before assigning.",
  async test(t) {
    await t.send(
      "Show me the DARFIX dispatch queue and which technicians you would assign. Use tools; do not invent ids.",
    );
    t.succeeded();
    t.calledTool("darfix_dispatch_queue");
  },
});
