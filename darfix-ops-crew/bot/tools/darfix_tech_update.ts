import { defineTool } from "@grok/agent-sdk/tools";
import * as z from "zod/v4";
import {
  addProgressNote,
  loginAs,
  listPendingBookings,
  toggleChecklist,
  updateJobStatus,
} from "../lib/darfixApi";
import { summarizeBooking, type BookingSummary } from "../lib/summarize";

type TechUpdateResult =
  | { ok: false; error: string; actor: string }
  | {
      ok: true
      actor: string
      bookingId: string
      statusUpdate?: BookingSummary
      note?: BookingSummary
      checklist?: BookingSummary
    }

export default defineTool({
  description:
    "Technician field actions on a job: update status (on_the_way, arrived, in_progress), add a progress note, and/or mark a checklist item done.",
  effect: "write",
  inputSchema: z.object({
    bookingId: z.string(),
    status: z
      .enum(["on_the_way", "arrived", "in_progress"])
      .optional()
      .describe("Optional status transition"),
    note: z.string().optional().describe("Progress note for the customer"),
    checklistItemId: z.string().optional(),
    checklistDone: z.boolean().optional().default(true),
  }),
  async execute({
    bookingId,
    status,
    note,
    checklistItemId,
    checklistDone,
  }): Promise<TechUpdateResult> {
    const { token, user } = await loginAs("technician");
    const state = await listPendingBookings(token);
    const booking = state.bookings.find((b) => b.id === bookingId);
    if (!booking) {
      return {
        ok: false,
        error: "Booking not assigned to demo technician or not found",
        actor: user.id,
      };
    }

    const result: TechUpdateResult = {
      ok: true,
      actor: user.id,
      bookingId,
    };
    if (status) {
      const { booking: updated } = await updateJobStatus(
        token,
        bookingId,
        status,
        note || undefined,
      );
      result.statusUpdate = summarizeBooking(updated);
    }
    if (note) {
      const { booking: updated } = await addProgressNote(token, bookingId, note);
      result.note = summarizeBooking(updated);
    }
    if (checklistItemId) {
      const { booking: updated } = await toggleChecklist(
        token,
        bookingId,
        checklistItemId,
        checklistDone ?? true,
      );
      result.checklist = summarizeBooking(updated);
    }
    return result;
  },
});
