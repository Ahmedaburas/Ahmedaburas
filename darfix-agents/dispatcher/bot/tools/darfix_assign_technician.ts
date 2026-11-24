import { defineTool } from "@grok/agent-sdk/tools";
import * as z from "zod/v4";
import { proposeApproval } from "../lib/approvalsApi";
import { assignTechnician, loginAs, listPendingBookings } from "../lib/darfixApi";
import { summarizeBooking } from "../lib/summarize";

type AssignResult =
  | { ok: false; error: string; requiresApproval?: boolean; approvalId?: string }
  | {
      ok: true
      technicianId: string
      reason: string
      booking: ReturnType<typeof summarizeBooking>
    }

export default defineTool({
  description:
    "Assign a technician to a DARFIX booking (first assignment only). Reassignment must be proposed for shift-lead approval.",
  effect: "write",
  inputSchema: z.object({
    bookingId: z.string(),
    technicianId: z
      .string()
      .optional()
      .describe("Optional explicit technician id. If omitted, auto-pick the best match."),
  }),
  async execute({ bookingId, technicianId }): Promise<AssignResult> {
    const { token } = await loginAs("admin");
    const state = await listPendingBookings(token);
    const booking = state.bookings.find((b) => b.id === bookingId);
    if (!booking) return { ok: false, error: "Booking not found" };

    let techId = technicianId;
    let reason = "explicit";
    if (!techId) {
      const candidates = state.users
        .filter(
          (u) =>
            u.role === "technician" &&
            u.active !== false &&
            (u.specialties?.includes(booking.categoryId) ?? true),
        )
        .map((u) => ({
          id: u.id,
          name: u.name,
          rating: u.rating ?? 0,
          openJobs: state.bookings.filter(
            (b) =>
              b.technicianId === u.id &&
              !["completed", "cancelled"].includes(b.status),
          ).length,
        }))
        .sort((a, b) => a.openJobs - b.openJobs || b.rating - a.rating);
      if (candidates.length === 0) {
        return { ok: false, error: "No matching active technicians" };
      }
      techId = candidates[0].id;
      reason = `auto: ${candidates[0].name} (openJobs=${candidates[0].openJobs}, rating=${candidates[0].rating})`;
    }

    if (booking.technicianId && booking.technicianId !== techId) {
      const proposed = await proposeApproval({
        action: "reassign_technician",
        bookingId,
        payload: { technicianId: techId },
        rationale: `Dispatcher requests reassignment (${reason})`,
        proposedBy: "dispatcher",
      });
      const approval = proposed.approval as { id?: string };
      return {
        ok: false,
        error: "Reassignment requires shift-lead approval — proposal created",
        requiresApproval: true,
        approvalId: String(approval?.id || ""),
      };
    }

    const { booking: updated } = await assignTechnician(token, bookingId, techId);
    return {
      ok: true,
      technicianId: techId,
      reason,
      booking: summarizeBooking(updated),
    };
  },
});
