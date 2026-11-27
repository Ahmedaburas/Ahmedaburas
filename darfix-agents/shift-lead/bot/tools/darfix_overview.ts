import { defineTool } from "@grok/agent-sdk/tools";
import * as z from "zod/v4";
import { loginAs, listPendingBookings } from "../lib/darfixApi";

export default defineTool({
  description:
    "Login as DARFIX admin and return an operations overview: booking counts by status, pending requests, active technicians, and recent jobs.",
  effect: "read",
  inputSchema: z.object({}),
  async execute() {
    const { token, user } = await loginAs("admin");
    const state = await listPendingBookings(token);
    const byStatus: Record<string, number> = {};
    for (const b of state.bookings) {
      byStatus[b.status] = (byStatus[b.status] || 0) + 1;
    }
    const pending = state.bookings
      .filter((b) =>
        ["new_request", "confirmed", "awaiting_approval"].includes(b.status),
      )
      .map((b) => ({
        id: b.id,
        status: b.status,
        categoryId: b.categoryId,
        problemId: b.problemId,
        technicianId: b.technicianId ?? null,
        preferredDate: b.preferredDate,
        step: b.process?.currentStepNote ?? null,
        estimatedFeeSar: b.estimatedFeeSar,
      }));
    const technicians = state.users
      .filter((u) => u.role === "technician")
      .map((u) => ({
        id: u.id,
        name: u.name,
        active: u.active !== false,
        specialties: u.specialties ?? [],
        rating: u.rating ?? null,
        openJobs: state.bookings.filter(
          (b) =>
            b.technicianId === u.id &&
            !["completed", "cancelled"].includes(b.status),
        ).length,
      }));
    return {
      actor: { id: user.id, name: user.name },
      totalBookings: state.bookings.length,
      byStatus,
      pending,
      technicians,
    };
  },
});
