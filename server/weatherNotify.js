import { alertSignature, exceededNotifyMetrics, notifyMetrics } from "./weather.js";

function riyadhTime(iso) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Riyadh",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

const BAND_INSTRUCTION = {
  wind: {
    warn: (tile) =>
      `${tile.label} is ${tile.display}. SOP-59 table: WARN at 32 km/h, STOP at 48 km/h. Warn the outdoor crews. Secure loose materials. Limit lifting and work at height. Stop outdoor work if the wind reaches 48 km/h.`,
    stop: (tile) =>
      `${tile.label} is ${tile.display}. SOP-59 table: STOP at 48 km/h. Stop outdoor work now. Stop lifting and work at height. Move the crews to a safe area. Do not restart outdoor work until the wind is below 48 km/h, and keep the WARN controls while it stays at 32 km/h or more.`,
  },
  rain: {
    warn: (tile) =>
      `${tile.label} is ${tile.display}. SOP-59 table: WARN at moderate rain (2.5 mm/h), STOP at heavy rain (7.6 mm/h). Warn the outdoor crews. Stop work on slippery surfaces and exposed electrical equipment. Stop all outdoor work if the rain reaches 7.6 mm/h.`,
    stop: (tile) =>
      `${tile.label} is ${tile.display}. SOP-59 table: STOP at heavy rain (7.6 mm/h). Stop outdoor work now. Keep the crews under cover until the rain is below 7.6 mm/h.`,
  },
  temperature: {
    caution: (tile) =>
      `${tile.label} is ${tile.display}. SOP-59 table: CAUTION at 33°C, HIGH at 40°C, EXTREME at 45°C. Use caution for heat. Provide drinking water, shade, and rest breaks. Watch for heat illness. Restrict outdoor work if the temperature reaches 40°C.`,
    high: (tile) =>
      `${tile.label} is ${tile.display}. SOP-59 table: HIGH at 40°C, EXTREME at 45°C. High heat risk. Shorten outdoor work, increase rest in the shade, and provide drinking water. Stop heavy outdoor tasks. Stop outdoor work if the temperature reaches 45°C.`,
    extreme: (tile) =>
      `${tile.label} is ${tile.display}. SOP-59 table: EXTREME at 45°C. Stop outdoor work for extreme heat. Move the crews to shade or a cooled area and watch for heat illness.`,
  },
  wbgt: {
    caution: (tile) =>
      `${tile.label} is ${tile.display}. SOP-59 table: CAUTION at 28°C, HIGH at 33°C, STOP at 35°C. Use caution for heat stress. Provide drinking water, shade, and scheduled rest, and use a buddy check. Restrict outdoor work if WBGT reaches 33°C.`,
    high: (tile) =>
      `${tile.label} is ${tile.display}. SOP-59 table: HIGH at 33°C, STOP at 35°C. High heat-stress risk. Cut outdoor work periods, enforce rest in the shade, and provide drinking water. Stop outdoor work if WBGT reaches 35°C.`,
    stop: (tile) =>
      `${tile.label} is ${tile.display}. SOP-59 table: STOP at 35°C. Stop outdoor work for heat stress. Move the crews to shade or a cooled area and watch for heat illness.`,
  },
};

export function safetyInstructions(snapshot) {
  return exceededNotifyMetrics(snapshot).map((tile) => {
    const write = BAND_INSTRUCTION[tile.id]?.[tile.level];
    return {
      id: tile.id,
      label: tile.label,
      display: tile.display,
      status: tile.status,
      text: write
        ? write(tile)
        : `${tile.label} is ${tile.display} (${tile.status}). Follow INMA-HSE-SOP-59 for this band.`,
    };
  });
}

export function formatWeatherAlert(snapshot) {
  const instructions = safetyInstructions(snapshot);
  const lines = [
    "Inma Steel · INMA-HSE-SOP-59 weather alert",
    `Location: ${snapshot.location}`,
    `Time (Asia/Riyadh): ${riyadhTime(snapshot.fetchedAt)}`,
    `Conditions: ${snapshot.condition}`,
    "",
    "Safety instructions for the thresholds that have been exceeded:",
    ...instructions.map((item, index) => `${index + 1}. ${item.text}`),
    "",
    "Readings used for this alert:",
    ...notifyMetrics(snapshot).map((tile) => `- ${tile.label}: ${tile.display} — ${tile.status}`),
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

export async function deliverToContacts(db, snapshot, { prevLevel, manual = false, contactIds = null } = {}) {
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
  const exceeded = exceededNotifyMetrics(snapshot);
  const subject = `SOP-59 exceeded: ${exceeded.map((tile) => tile.label).join(", ") || snapshot.location}`;
  const text = formatWeatherAlert(snapshot);
  const newLevel = exceeded.map((tile) => `${tile.label} ${tile.status}`).join(", ") || snapshot.overall.level;
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
  ).run(createdAt, prevLevel || "", newLevel, text.slice(0, 4000), JSON.stringify(log), manual ? 1 : 0);
  return log;
}

export function shouldAutoNotify(prevSignature, snapshot) {
  if (!exceededNotifyMetrics(snapshot).length) return false;
  if (!prevSignature) return true;
  return alertSignature(snapshot) !== prevSignature;
}
