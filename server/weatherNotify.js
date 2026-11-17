import { alertSignature, exceededNotifyMetrics, heatNotifyBand } from "./weather.js";

const BAND_INSTRUCTION = {
  wind: {
    warn: () => "Secure loose materials. Limit lifting and work at height. Stop outdoor work if the wind reaches 48 km/h.",
    stop: () => "Stop outdoor work. Stop lifting and work at height. Move crews to a safe area.",
  },
  rain: {
    warn: () => "Stop work on slippery surfaces and exposed electrical equipment. Stop all outdoor work if rain reaches 7.6 mm/h.",
    stop: () => "Stop outdoor work. Keep crews under cover.",
  },
};

function wbgtInstruction(snapshot) {
  const water = "Water intake: 4–6 cups per hour.";
  if (heatNotifyBand(snapshot.raw?.wbgt) === "extreme_danger") {
    return `All workloads. Work/rest: 25% work / 75% rest, or stop. Suspend outdoor work. ${water}`;
  }
  return `Heavy workload. Work/rest: 50% work / 50% rest. Restrict heavy work. ${water}`;
}

export function safetyInstructions(snapshot) {
  return exceededNotifyMetrics(snapshot).map((tile) => {
    if (tile.id === "wbgt") {
      const band = heatNotifyBand(snapshot.raw?.wbgt);
      return {
        id: tile.id,
        label: tile.label,
        display: `${Number(snapshot.raw.wbgt).toFixed(1)}°C`,
        status: band === "extreme_danger" ? "EXTREME DANGER" : "DANGER",
        text: wbgtInstruction(snapshot),
      };
    }
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

const ALERT_TITLES = {
  wbgt: "Heat stress alert",
  rain: "Rain alert",
  wind: "Wind alert",
};

export function formatWeatherAlerts(snapshot) {
  const grouped = new Map();
  for (const item of safetyInstructions(snapshot)) {
    const title = ALERT_TITLES[item.id] || "Weather alert";
    if (!grouped.has(title)) grouped.set(title, []);
    grouped.get(title).push(item);
  }
  return [...grouped.entries()].map(([title, items]) => {
    const text = [title, ...items.map((item) => `${item.label}: ${item.display} — ${item.status}\n${item.text}`)].join("\n");
    return {
      title,
      subject: `SOP-59 ${title}`,
      text,
      shareUrl: `https://wa.me/?text=${encodeURIComponent(text)}`,
    };
  });
}

export function formatWeatherAlert(snapshot) {
  return formatWeatherAlerts(snapshot)
    .map((message) => message.text)
    .join("\n\n");
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

export async function sendWebhook(text, url = process.env.WHATSAPP_WEBHOOK_URL) {
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
  const messages = formatWeatherAlerts(snapshot);
  const text = messages.map((message) => message.text).join("\n\n");
  const newLevel =
    safetyInstructions(snapshot)
      .map((item) => `${item.label} ${item.status}`)
      .join(", ") || snapshot.overall.level;
  const log = [];
  const group = db
    .prepare("SELECT whatsapp_group_name, whatsapp_group_webhook, whatsapp_group_invite FROM weather_settings WHERE id = 1")
    .get();
  const groupUrl = String(group?.whatsapp_group_webhook || "").trim() || process.env.WHATSAPP_WEBHOOK_URL || "";
  for (const message of messages) {
    log.push({
      contactId: null,
      name: group?.whatsapp_group_name || "HSE live board",
      channel: "live-board",
      alert: message.title,
      ok: true,
      detail: "/weather/board",
    });
    for (const contact of contacts) {
      if (contact.notify_email && contact.email) {
        const result = await sendEmail({ to: contact.email, subject: message.subject, text: message.text });
        log.push({ contactId: contact.id, name: contact.name, channel: "email", alert: message.title, ...result });
      }
      if (contact.notify_whatsapp && contact.whatsapp) {
        const result = await sendWhatsApp({ to: contact.whatsapp, text: message.text });
        log.push({ contactId: contact.id, name: contact.name, channel: "whatsapp", alert: message.title, ...result });
      }
    }
    if (groupUrl) {
      const webhook = await sendWebhook(message.text, groupUrl);
      log.push({
        contactId: null,
        name: group?.whatsapp_group_name || "WhatsApp group",
        channel: "whatsapp-group",
        alert: message.title,
        ...webhook,
      });
    }
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
