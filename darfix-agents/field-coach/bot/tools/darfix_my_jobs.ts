import { defineTool } from "@grok/agent-sdk/tools";
import * as z from "zod/v4";
import { loginAs, listPendingBookings } from "../lib/darfixApi";

export default defineTool({
  description:
    "List jobs assigned to the demo technician (active and recent), including process step notes.",
  effect: "read",
  inputSchema: z.object({}),
  async execute() {
    const { token, user } = await loginAs("technician");
    const state = await listPendingBookings(token);
    const jobs = state.bookings.map((b) => ({
      id: b.id,
      status: b.status,
      categoryId: b.categoryId,
      problemId: b.problemId,
      preferredDate: b.preferredDate,
      step: b.process?.currentStepNote ?? null,
      estimatedFeeSar: b.estimatedFeeSar,
    }));
    return { ok: true as const, technicianId: user.id, jobs };
  },
});
