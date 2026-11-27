import { defineTool } from "@grok/agent-sdk/tools";
import * as z from "zod/v4";
import { confirmBooking, loginAs } from "../lib/darfixApi";
import { summarizeBooking } from "../lib/summarize";

export default defineTool({
  description:
    "Confirm a DARFIX booking that is still in new_request status (admin action).",
  effect: "write",
  inputSchema: z.object({
    bookingId: z.string().describe("Booking id, e.g. bk-1003"),
  }),
  async execute({ bookingId }) {
    const { token } = await loginAs("admin");
    const { booking } = await confirmBooking(token, bookingId);
    return { ok: true as const, booking: summarizeBooking(booking) };
  },
});
