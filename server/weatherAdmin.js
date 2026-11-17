import { HttpError } from "./domain.js";
import { listPeople } from "./records.js";
import { deliverToContacts, formatWeatherAlert, formatWeatherAlerts, shouldAutoNotify } from "./weatherNotify.js";
import { exportWeatherWorkbook, weatherReportFilename } from "./weatherReport.js";
import {
  alertSignature,
  exceededNotifyMetrics,
  getCachedWeather,
  refreshWeatherReading,
  unavailableSnapshot,
} from "./weather.js";

function rowToContact(row) {
  return {
    id: row.id,
    name: row.name,
    personId: row.person_id,
    email: row.email,
    whatsapp: row.whatsapp,
    notifyEmail: Boolean(row.notify_email),
    notifyWhatsapp: Boolean(row.notify_whatsapp),
    createdAt: row.created_at,
  };
}

export function getSettings(db) {
  const row = db
    .prepare(
      `SELECT auto_notify, last_overall_level, last_fetched_at, last_alert_signature,
              whatsapp_group_name, whatsapp_group_webhook, whatsapp_group_invite
       FROM weather_settings WHERE id = 1`,
    )
    .get();
  if (!row) {
    db.prepare("INSERT INTO weather_settings (id, auto_notify) VALUES (1, 1)").run();
    return {
      autoNotify: true,
      lastOverallLevel: null,
      lastFetchedAt: null,
      lastAlertSignature: null,
      whatsappGroupName: "",
      whatsappGroupWebhook: "",
      whatsappGroupInvite: "",
    };
  }
  return {
    autoNotify: Boolean(row.auto_notify),
    lastOverallLevel: row.last_overall_level,
    lastFetchedAt: row.last_fetched_at,
    lastAlertSignature: row.last_alert_signature,
    whatsappGroupName: row.whatsapp_group_name || "",
    whatsappGroupWebhook: row.whatsapp_group_webhook || "",
    whatsappGroupInvite: row.whatsapp_group_invite || "",
  };
}

export function isWhatsAppInvite(url) {
  try {
    const parsed = new URL(url);
    return parsed.hostname === "chat.whatsapp.com" || parsed.hostname.endsWith(".whatsapp.com");
  } catch {
    return false;
  }
}

export function classifyGroupTarget(value) {
  const raw = String(value || "").trim();
  if (!raw) return { invite: "", webhook: "" };
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    throw new HttpError(400, "Paste the WhatsApp group invite (chat.whatsapp.com/…) or an https webhook.");
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new HttpError(400, "Paste the WhatsApp group invite (chat.whatsapp.com/…) or an https webhook.");
  }
  if (isWhatsAppInvite(raw)) return { invite: raw, webhook: "" };
  return { invite: "", webhook: raw };
}

export function assertGroupWebhook(url) {
  if (!url) return;
  if (isWhatsAppInvite(url)) return;
  classifyGroupTarget(url);
}

export function updateSettings(db, body) {
  const current = getSettings(db);
  const autoNotify = body.autoNotify !== undefined ? Boolean(body.autoNotify) : current.autoNotify;
  const whatsappGroupName =
    body.whatsappGroupName !== undefined ? String(body.whatsappGroupName || "").trim() : current.whatsappGroupName;
  let whatsappGroupInvite =
    body.whatsappGroupInvite !== undefined
      ? String(body.whatsappGroupInvite || "").trim()
      : current.whatsappGroupInvite;
  let whatsappGroupWebhook =
    body.whatsappGroupWebhook !== undefined
      ? String(body.whatsappGroupWebhook || "").trim()
      : current.whatsappGroupWebhook;
  if (body.whatsappGroupWebhook !== undefined && isWhatsAppInvite(whatsappGroupWebhook)) {
    const classified = classifyGroupTarget(whatsappGroupWebhook);
    whatsappGroupInvite = classified.invite || whatsappGroupInvite;
    whatsappGroupWebhook = "";
  } else if (whatsappGroupWebhook) {
    assertGroupWebhook(whatsappGroupWebhook);
  }
  if (whatsappGroupInvite && !isWhatsAppInvite(whatsappGroupInvite)) {
    throw new HttpError(400, "The group invite must be a chat.whatsapp.com link.");
  }
  db.prepare(
    `UPDATE weather_settings
     SET auto_notify = ?, whatsapp_group_name = ?, whatsapp_group_webhook = ?, whatsapp_group_invite = ?
     WHERE id = 1`,
  ).run(autoNotify ? 1 : 0, whatsappGroupName, whatsappGroupWebhook, whatsappGroupInvite);
  return getSettings(db);
}

export function listContacts(db) {
  return db.prepare("SELECT * FROM weather_contacts ORDER BY name").all().map(rowToContact);
}

export function getContact(db, id) {
  const row = db.prepare("SELECT * FROM weather_contacts WHERE id = ?").get(id);
  return row ? rowToContact(row) : null;
}

export function resolveReportRecipient(db, query = {}) {
  const contactId = Number(query.contactId || 0);
  if (contactId) {
    const contact = getContact(db, contactId);
    if (!contact) throw new HttpError(404, "Contact not found");
    return contact;
  }
  const personId = Number(query.personId || 0);
  if (personId) {
    const person = listPeople(db).find((row) => row.id === personId);
    if (!person) throw new HttpError(404, "Person not found");
    const linked = listContacts(db).find((row) => row.personId === personId);
    return {
      id: linked?.id || null,
      name: person.name,
      personId: person.id,
      email: linked?.email || person.email,
      whatsapp: linked?.whatsapp || "",
      notifyEmail: linked ? linked.notifyEmail : true,
      notifyWhatsapp: linked ? linked.notifyWhatsapp : false,
      jobTitle: person.jobTitle,
    };
  }
  return null;
}

export function exportWeatherReport(db, snapshot, query = {}) {
  const recipient = resolveReportRecipient(db, query);
  const buffer = exportWeatherWorkbook(snapshot, { recipient, settings: getSettings(db) });
  return { buffer, filename: weatherReportFilename(recipient), recipient };
}

export function createContact(db, body) {
  const name = String(body.name || "").trim();
  if (!name) throw new Error("Name is required");
  const createdAt = new Date().toISOString();
  const id = Number(
    db
      .prepare(
        `INSERT INTO weather_contacts (name, person_id, email, whatsapp, notify_email, notify_whatsapp, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        name,
        body.personId ? Number(body.personId) : null,
        String(body.email || "").trim(),
        String(body.whatsapp || "").trim(),
        body.notifyEmail === false ? 0 : 1,
        body.notifyWhatsapp ? 1 : 0,
        createdAt,
      ).lastInsertRowid,
  );
  return rowToContact(db.prepare("SELECT * FROM weather_contacts WHERE id = ?").get(id));
}

export function deleteContact(db, id) {
  db.prepare("DELETE FROM weather_group_members WHERE contact_id = ?").run(id);
  db.prepare("DELETE FROM weather_contacts WHERE id = ?").run(id);
}

export function listGroups(db) {
  const groups = db.prepare("SELECT id, name, created_at FROM weather_groups ORDER BY name").all();
  return groups.map((group) => {
    const memberIds = db
      .prepare("SELECT contact_id FROM weather_group_members WHERE group_id = ?")
      .all(group.id)
      .map((row) => row.contact_id);
    return { id: group.id, name: group.name, createdAt: group.created_at, contactIds: memberIds };
  });
}

export function createGroup(db, body) {
  const name = String(body.name || "").trim();
  if (!name) throw new Error("Group name is required");
  const createdAt = new Date().toISOString();
  const groupId = Number(
    db.prepare("INSERT INTO weather_groups (name, created_at) VALUES (?, ?)").run(name, createdAt).lastInsertRowid,
  );
  const contactIds = Array.isArray(body.contactIds) ? body.contactIds.map(Number).filter((n) => n > 0) : [];
  const insert = db.prepare("INSERT INTO weather_group_members (group_id, contact_id) VALUES (?, ?)");
  for (const contactId of contactIds) insert.run(groupId, contactId);
  return listGroups(db).find((g) => g.id === groupId);
}

export function deleteGroup(db, id) {
  db.prepare("DELETE FROM weather_group_members WHERE group_id = ?").run(id);
  db.prepare("DELETE FROM weather_groups WHERE id = ?").run(id);
}

export function listNotifications(db, limit = 20) {
  return db
    .prepare(
      `SELECT id, created_at, prev_level, new_level, summary, delivery_log, manual
       FROM weather_notifications ORDER BY id DESC LIMIT ?`,
    )
    .all(limit)
    .map((row) => ({
      id: row.id,
      createdAt: row.created_at,
      prevLevel: row.prev_level,
      newLevel: row.new_level,
      summary: row.summary,
      manual: Boolean(row.manual),
      delivery: JSON.parse(row.delivery_log || "[]"),
    }));
}

export async function getWeather(db, { force = false } = {}) {
  const cached = !force ? getCachedWeather() : null;
  let snapshot;
  let refreshed = false;
  if (cached) snapshot = cached;
  else {
    try {
      snapshot = await refreshWeatherReading({ force: true });
      refreshed = !snapshot.stale && !snapshot.unavailable;
    } catch (error) {
      console.warn("Weather refresh failed", error.message);
      snapshot = unavailableSnapshot(error.message);
    }
  }
  const settings = getSettings(db);
  let notified = false;
  if (refreshed && !snapshot.unavailable && !snapshot.stale) {
    const signature = alertSignature(snapshot);
    if (settings.autoNotify && shouldAutoNotify(settings.lastAlertSignature, snapshot)) {
      await deliverToContacts(db, snapshot, { prevLevel: settings.lastAlertSignature, manual: false });
      notified = true;
    }
    db.prepare(
      "UPDATE weather_settings SET last_overall_level = ?, last_fetched_at = ?, last_alert_signature = ? WHERE id = 1",
    ).run(snapshot.overall.level, snapshot.fetchedAt, signature);
  }
  const exceeded = exceededNotifyMetrics(snapshot);
  return {
    ...snapshot,
    settings: getSettings(db),
    notified,
    exceeded,
    alertMessage: exceeded.length ? formatWeatherAlert(snapshot) : "",
    alertMessages: exceeded.length ? formatWeatherAlerts(snapshot) : [],
  };
}

export async function notifyNow(db, { groupIds = [] } = {}) {
  let snapshot;
  try {
    snapshot = getCachedWeather() || (await refreshWeatherReading({ force: false }));
  } catch (error) {
    return {
      sent: false,
      reason: "Live weather could not be reached. No alert sent.",
      log: [],
    };
  }
  if (snapshot.unavailable) {
    return {
      sent: false,
      reason: "Live weather could not be reached. No alert sent.",
      log: [],
    };
  }
  const settings = getSettings(db);
  let contactIds = null;
  if (groupIds.length) {
    const ids = new Set();
    for (const gid of groupIds) {
      const group = listGroups(db).find((g) => g.id === gid);
      if (group) group.contactIds.forEach((id) => ids.add(id));
    }
    contactIds = [...ids];
  }
  const exceeded = exceededNotifyMetrics(snapshot);
  if (!exceeded.length) {
    return {
      sent: false,
      reason: "No alert sent. Wind and rain are inside their SOP-59 limits, and WBGT is under 42°C.",
      log: [],
    };
  }
  const log = await deliverToContacts(db, snapshot, {
    prevLevel: settings.lastAlertSignature,
    manual: true,
    contactIds,
  });
  return { sent: true, snapshot, log };
}

export function startWeatherPoller(db) {
  const tick = async () => {
    try {
      await getWeather(db, { force: true });
    } catch (error) {
      console.warn("Weather refresh failed", error.message);
    }
  };
  tick();
  return setInterval(tick, 5 * 60 * 1000);
}
