/**
 * Thin HTTP client for the DARFIX Express API.
 * Base URL: DARFIX_API_URL (default http://127.0.0.1:8787)
 */

import { credentialsFor, type RoleAccount } from "./credentials";

export type { RoleAccount };
function baseUrl() {
  return (process.env.DARFIX_API_URL || "http://127.0.0.1:8787").replace(/\/$/, "");
}

async function request<T>(
  path: string,
  init: RequestInit & { token?: string } = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (init.token) headers.set("Authorization", `Bearer ${init.token}`);
  const res = await fetch(`${baseUrl()}${path}`, { ...init, headers });
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    const err = data as { error?: string };
    throw new Error(err?.error || `DARFIX API ${res.status} on ${path}`);
  }
  return data as T;
}

export async function loginAs(role: RoleAccount) {
  const account = credentialsFor(role);
  return request<{ token: string; user: { id: string; role: string; name: string; email: string } }>(
    "/api/auth/login",
    { method: "POST", body: JSON.stringify(account) },
  );
}

export async function bootstrap(token: string, locale: "en" | "ar" = "en") {
  return request<Record<string, unknown>>(`/api/bootstrap?locale=${locale}`, { token });
}

export async function listPendingBookings(token: string) {
  const state = (await bootstrap(token)) as {
    bookings: Array<{
      id: string;
      status: string;
      categoryId: string;
      problemId: string;
      customerId: string;
      technicianId?: string;
      preferredDate: string;
      preferredTimeSlot: string;
      estimatedFeeSar: number;
      process?: { currentStepNote?: string };
    }>;
    users: Array<{ id: string; role: string; name: string; nameAr: string; specialties?: string[]; active?: boolean; rating?: number }>;
  };
  return state;
}

export async function confirmBooking(token: string, bookingId: string) {
  return request<{ booking: unknown }>(`/api/bookings/${bookingId}/status`, {
    method: "PATCH",
    token,
    body: JSON.stringify({ status: "confirmed", note: "Confirmed by DARFIX ops agent" }),
  });
}

export async function assignTechnician(token: string, bookingId: string, technicianId: string) {
  return request<{ booking: unknown }>(`/api/bookings/${bookingId}/assign`, {
    method: "POST",
    token,
    body: JSON.stringify({ technicianId }),
  });
}

export async function updateJobStatus(
  token: string,
  bookingId: string,
  status: string,
  note?: string,
) {
  return request<{ booking: unknown }>(`/api/bookings/${bookingId}/status`, {
    method: "PATCH",
    token,
    body: JSON.stringify({ status, note }),
  });
}

export async function addProgressNote(token: string, bookingId: string, text: string) {
  return request<{ booking: unknown }>(`/api/bookings/${bookingId}/process/note`, {
    method: "POST",
    token,
    body: JSON.stringify({ text }),
  });
}

export async function toggleChecklist(
  token: string,
  bookingId: string,
  itemId: string,
  done: boolean,
) {
  return request<{ booking: unknown }>(`/api/bookings/${bookingId}/process/checklist`, {
    method: "PATCH",
    token,
    body: JSON.stringify({ itemId, done }),
  });
}

export async function getHealth() {
  return request<{ ok: boolean; service: string }>("/api/health");
}

export { baseUrl };
