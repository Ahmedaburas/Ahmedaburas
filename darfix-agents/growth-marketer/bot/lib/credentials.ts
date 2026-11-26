/**
 * Shared credential helper for DARFIX peer agents.
 * Never hardcode passwords — use environment variables only.
 */

export type RoleAccount = "customer" | "technician" | "admin" | "provider";

export function credentialsFor(role: RoleAccount): { email: string; password: string } {
  if (role === "admin") {
    const email = process.env.DARFIX_ADMIN_EMAIL?.trim();
    const password = process.env.DARFIX_ADMIN_PASSWORD;
    if (!email || !password) {
      throw new Error("Set DARFIX_ADMIN_EMAIL and DARFIX_ADMIN_PASSWORD (no hardcoded demo passwords).");
    }
    return { email, password };
  }
  if (role === "provider") {
    const email = process.env.DARFIX_PROVIDER_EMAIL?.trim();
    const password = process.env.DARFIX_PROVIDER_PASSWORD;
    if (!email || !password) {
      throw new Error("Set DARFIX_PROVIDER_EMAIL and DARFIX_PROVIDER_PASSWORD.");
    }
    return { email, password };
  }
  if (role === "technician") {
    const email = process.env.DARFIX_TECH_EMAIL?.trim();
    const password = process.env.DARFIX_TECH_PASSWORD;
    if (!email || !password) {
      throw new Error("Set DARFIX_TECH_EMAIL and DARFIX_TECH_PASSWORD.");
    }
    return { email, password };
  }
  const email = process.env.DARFIX_CUSTOMER_EMAIL?.trim();
  const password = process.env.DARFIX_CUSTOMER_PASSWORD;
  if (!email || !password) {
    throw new Error("Set DARFIX_CUSTOMER_EMAIL and DARFIX_CUSTOMER_PASSWORD.");
  }
  return { email, password };
}
