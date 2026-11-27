import { defineTool } from "@grok/agent-sdk/tools";
import * as z from "zod/v4";
import { loginAs, listPendingBookings } from "../lib/darfixApi";

export default defineTool({
  description:
    "Return the dispatch queue: new/confirmed bookings needing assignment, plus suggested technician matches.",
  effect: "read",
  inputSchema: z.object({}),
  async execute() {
    const { token } = await loginAs("admin");
    const state = await listPendingBookings(token);
    const techs = state.users.filter(
      (u) => u.role === "technician" && u.active !== false,
    );
    const queue = state.bookings
      .filter((b) =>
        ["new_request", "confirmed", "technician_assigned"].includes(b.status),
      )
      .map((b) => {
        const matches = techs
          .filter((t) => t.specialties?.includes(b.categoryId) ?? true)
          .map((t) => {
            const openJobs = state.bookings.filter(
              (x) =>
                x.technicianId === t.id &&
                !["completed", "cancelled"].includes(x.status),
            ).length;
            return {
              id: t.id,
              name: t.name,
              rating: t.rating ?? null,
              openJobs,
              score: (t.rating ?? 0) * 10 - openJobs,
            };
          })
          .sort((a, b) => b.score - a.score);
        return {
          id: b.id,
          status: b.status,
          categoryId: b.categoryId,
          problemId: b.problemId,
          preferredDate: b.preferredDate,
          preferredTimeSlot: b.preferredTimeSlot,
          currentTechnicianId: b.technicianId ?? null,
          suggestedTechnician: matches[0] ?? null,
          alternates: matches.slice(1, 3),
        };
      });
    return { queueCount: queue.length, queue };
  },
});
