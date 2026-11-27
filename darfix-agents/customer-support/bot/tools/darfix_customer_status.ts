import { defineTool } from "@grok/agent-sdk/tools";
import * as z from "zod/v4";
import { loginAs, listPendingBookings } from "../lib/darfixApi";

export default defineTool({
  description:
    "Fetch a customer-facing status summary for a booking (or all of Sara's demo customer bookings). Use for support questions about where a job is.",
  effect: "read",
  inputSchema: z.object({
    bookingId: z.string().optional(),
  }),
  async execute({ bookingId }) {
    const { token, user } = await loginAs("customer");
    const state = await listPendingBookings(token);
    const bookings = bookingId
      ? state.bookings.filter((b) => b.id === bookingId)
      : state.bookings;
    const techById = Object.fromEntries(
      state.users.filter((u) => u.role === "technician").map((u) => [u.id, u]),
    );
    return {
      customer: { id: user.id, name: user.name },
      bookings: bookings.map((b) => {
        const tech = b.technicianId ? techById[b.technicianId] : undefined;
        return {
          id: b.id,
          status: b.status,
          categoryId: b.categoryId,
          problemId: b.problemId,
          preferredDate: b.preferredDate,
          preferredTimeSlot: b.preferredTimeSlot,
          estimatedFeeSar: b.estimatedFeeSar,
          step: b.process?.currentStepNote ?? null,
          technician: tech
            ? { id: tech.id, name: tech.name, rating: tech.rating ?? null }
            : null,
        };
      }),
    };
  },
});
