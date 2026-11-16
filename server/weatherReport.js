import { workbookBuffer } from "./xlsx.js";
import { safetyInstructions } from "./weatherNotify.js";

const LIMITS = {
  wind: "STOP ≥48 km/h · WARN ≥32 km/h",
  rain: "STOP ≥7.6 mm/h · WARN ≥2.5 mm/h",
  lightning: "STOP if lightning is detected",
  wbgt: "Notify ≥42°C · STOP ≥35 · HIGH ≥33 · CAUTION ≥28",
  temperature: "EXTREME ≥45°C · HIGH ≥40°C · CAUTION ≥33°C",
  feels: "Same bands as temperature",
  visibility: "STOP <200 m · WARN <500 m",
  humidity: "STOP ≥95% · WARN ≥80%",
  pressure: "Reference only",
};

function riyadhStamp(iso) {
  const value = iso ? new Date(iso) : new Date();
  if (Number.isNaN(value.getTime())) return "";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Riyadh",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

function slug(value) {
  return String(value || "site")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40) || "site";
}

export function weatherReportFilename(recipient) {
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh" }).format(new Date());
  return `inma-sop59-weather-${slug(recipient?.name)}-${day}.xlsx`;
}

function channels(recipient) {
  if (!recipient) return "Site report";
  const items = [];
  if (recipient.notifyEmail !== false && recipient.email) items.push(`Email ${recipient.email}`);
  if (recipient.notifyWhatsapp && recipient.whatsapp) items.push(`WhatsApp ${recipient.whatsapp}`);
  else if (recipient.email && !items.length) items.push(`Email ${recipient.email}`);
  return items.join(" · ") || "No channel set";
}

export function exportWeatherWorkbook(snapshot, { recipient, settings } = {}) {
  const alerts = safetyInstructions(snapshot);
  const issued = riyadhStamp(snapshot.fetchedAt);
  const summary = [
    ["INMA-HSE-SOP-59 weather report", "Inma Steel Fabricators"],
    ["Procedure", "Control of outdoor operations during adverse weather"],
    ["Issued for", recipient?.name || "Site"],
    ["Job title", recipient?.jobTitle || recipient?.job_title || ""],
    ["Notify", channels(recipient)],
    ["Location", snapshot.location || "Jubail 2nd Industrial Area"],
    ["Conditions", snapshot.condition || ""],
    ["Issued (Asia/Riyadh)", issued],
    ["Overall", snapshot.overall?.label || ""],
    ["Auto sending", settings?.autoNotify === false ? "Off" : "On"],
    ["Source", snapshot.source || ""],
    [],
    ["Caution"],
    ...(alerts.length
      ? alerts.map((item) => [`${item.label} ${item.display} — ${item.status}`, item.text])
      : [["None", "Wind, rain, and WBGT are inside the notify limits."]]),
  ];
  const readings = [
    ["Parameter", "Reading", "Status", "SOP-59 limit", "Instruction"],
    ...snapshot.tiles.map((tile) => {
      const alert = alerts.find((item) => item.id === tile.id);
      return [
        tile.label,
        tile.display,
        tile.status,
        LIMITS[tile.id] || tile.hint || "",
        alert?.text || (tile.level === "safe" || tile.level === "ok" || tile.level === "clear" || tile.level === "reference"
          ? "Inside limit."
          : tile.hint || ""),
      ];
    }),
  ];
  return workbookBuffer([
    { name: "Summary", rows: summary },
    { name: "Readings", rows: readings },
  ]);
}
