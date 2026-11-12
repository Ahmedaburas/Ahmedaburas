import { levelRank } from "./weather.js";

function riyadhTime(iso) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Riyadh",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

export function formatWeatherAlert(snapshot, prevLevel, newLevel) {
  const lines = [
    `Inma Steel · SOP-59 weather alert`,
    `Location: ${snapshot.location}`,
    `Overall: ${snapshot.overall.label} (was ${prevLevel || "unknown"})`,
    `Conditions: ${snapshot.condition}`,
    `Time (Riyadh): ${riyadhTime(snapshot.fetchedAt)}`,
    "",
    ...snapshot.tiles
      .filter((t) => t.level !== "reference")
      .map((t) => `${t.label}: ${t.display} — ${t.status}`),
  ];
  return lines.join("\n");
}

export async function sendEmail({ to, subject, text }) {
  const host = process.env.SMTP_HOST;
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  if (!host || !from) return { ok: false, detail: "email not configured" };
  try {
    const nodemailer = await import("nodemailer").then((m) => m.default).catch(() => null);
    if (!nodemailer) return { ok: false, detail: "nodemailer not installed" };
    const transporter = nodemailer.createTransport({
      host,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === "1",
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS || "" }
        : undefined,
    });
    await transporter.sendMail({ from, to, subject, text });
    return { ok: true, detail: "sent" };
  } catch (error) {
    return { ok: false, detail: error.message };
  }
}

export async function sendWhatsApp({ to, text }) {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneId || !to) return { ok: false, detail: "whatsapp not configured" };
  const digits = to.replace(/\D/g, "");
  try {
    const response = await fetch(`https://graph.facebook.com/v19.0/${phoneId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: digits,
        type: "text",
        text: { body: text.slice(0, 4096) },
      }),
    });
    if (!response.ok) {
      const body = await response.text();
      return { ok: false, detail: body.slice(0, 200) };
    }
    return { ok: true, detail: "sent" };
  } catch (error) {
    return { ok: false, detail: error.message };
  }
}

export async function sendWebhook(text) {
  const url = process.env.WHATSAPP_WEBHOOK_URL;
  if (!url) return { ok: false, detail: "webhook not configured" };
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, source: "hse-sop-59" }),
    });
    if (!response.ok) return { ok: false, detail: `webhook ${response.status}` };
    return { ok: true, detail: "sent" };
  } catch (error) {
    return { ok: false, detail: error.message };
  }
}

export async function deliverToContacts(db, snapshot, { prevLevel, newLevel, manual = false, contactIds = null } = {}) {
  let contacts = db
    .prepare(
      `SELECT id, name, email, whatsapp, notify_email, notify_whatsapp
       FROM weather_contacts ORDER BY name`,
    )
    .all();
  if (contactIds?.length) {
    const allowed = new Set(contactIds.map(Number));
    contacts = contacts.filter((row) => allowed.has(row.id));
  }
  const subject = `SOP-59 ${snapshot.overall.label}: ${snapshot.location}`;
  const text = formatWeatherAlert(snapshot, prevLevel, newLevel);
  const log = [];
  for (const contact of contacts) {
    if (contact.notify_email && contact.email) {
      const result = await sendEmail({ to: contact.email, subject, text });
      log.push({ contactId: contact.id, name: contact.name, channel: "email", ...result });
    }
    if (contact.notify_whatsapp && contact.whatsapp) {
      const result = await sendWhatsApp({ to: contact.whatsapp, text });
      log.push({ contactId: contact.id, name: contact.name, channel: "whatsapp", ...result });
    }
  }
  const webhook = await sendWebhook(text);
  if (webhook.detail !== "webhook not configured") {
    log.push({ contactId: null, name: "WhatsApp group webhook", channel: "webhook", ...webhook });
  }
  if (log.length === 0 && manual) {
    log.push({ contactId: null, name: "—", channel: "none", ok: false, detail: "no contacts or channels configured" });
  }
  const createdAt = new Date().toISOString();
  db.prepare(
    `INSERT INTO weather_notifications (created_at, prev_level, new_level, summary, delivery_log, manual)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(createdAt, prevLevel || "", newLevel, text.slice(0, 500), JSON.stringify(log), manual ? 1 : 0);
  return log;
}

export function shouldAutoNotify(prevLevel, newLevel) {
  if (!prevLevel) return false;
  return levelRank(newLevel) !== levelRank(prevLevel);
}
