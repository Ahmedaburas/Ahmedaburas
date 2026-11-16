import { useCallback, useEffect, useMemo, useState } from "react";
import { api, request } from "../api.js";
import { useMeta } from "../meta.js";
import { Banner, PageHeader } from "../ui.jsx";

function channelLabel(contact) {
  const items = [];
  if (contact?.notifyEmail) items.push("email");
  if (contact?.notifyWhatsapp) items.push("WhatsApp");
  return items.join(" · ") || "not on alerts";
}

export function WeatherAlerts() {
  const meta = useMeta();
  const [settings, setSettings] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [groups, setGroups] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [alertMessage, setAlertMessage] = useState("");
  const [groupName, setGroupName] = useState("");
  const [groupInvite, setGroupInvite] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const reload = useCallback(async () => {
    try {
      const [s, c, g, n, weather] = await Promise.all([
        api.get("/api/weather/settings"),
        api.get("/api/weather/contacts"),
        api.get("/api/weather/groups"),
        api.get("/api/weather/notifications?limit=15"),
        api.get("/api/weather"),
      ]);
      setSettings(s);
      setContacts(c.items);
      setGroups(g.items);
      setNotifications(n.items);
      setAlertMessage(weather.alertMessage || "");
      setGroupName(s.whatsappGroupName || "");
      setGroupInvite(s.whatsappGroupInvite || s.whatsappGroupWebhook || "");
      setError("");
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const users = useMemo(() => {
    const fromPeople = meta.people.map((person) => {
      const contact = contacts.find((row) => row.personId === person.id);
      return {
        key: `person-${person.id}`,
        name: person.name,
        detail: person.jobTitle || person.email,
        email: contact?.email || person.email,
        whatsapp: contact?.whatsapp || "",
        contact,
        reportHref: `/api/weather/report.xlsx?personId=${person.id}`,
      };
    });
    const extras = contacts
      .filter((row) => !row.personId)
      .map((contact) => ({
        key: `contact-${contact.id}`,
        name: contact.name,
        detail: contact.email || contact.whatsapp || "",
        email: contact.email,
        whatsapp: contact.whatsapp,
        contact,
        reportHref: `/api/weather/contacts/${contact.id}/report.xlsx`,
      }));
    return [...fromPeople, ...extras];
  }, [contacts, meta.people]);

  async function toggleAutoNotify() {
    const next = await request("/api/weather/settings", {
      method: "PUT",
      body: JSON.stringify({ autoNotify: !settings.autoNotify }),
    });
    setSettings(next);
    setMessage(next.autoNotify ? "Auto sending is on." : "Auto sending is off.");
  }

  async function saveWhatsAppGroup(event) {
    event.preventDefault();
    try {
      const next = await api.put("/api/weather/settings", {
        whatsappGroupName: groupName,
        whatsappGroupInvite: groupInvite.startsWith("https://chat.whatsapp.com") ? groupInvite : "",
        whatsappGroupWebhook: groupInvite.startsWith("https://chat.whatsapp.com") ? "" : groupInvite,
      });
      setSettings(next);
      setGroupName(next.whatsappGroupName || "");
      setGroupInvite(next.whatsappGroupInvite || next.whatsappGroupWebhook || "");
      setMessage(next.whatsappGroupInvite ? "Group invite saved. Pin /weather/board in the group." : "WhatsApp group updated.");
      setError("");
    } catch (err) {
      setError(err.message);
    }
  }

  async function notifyNow() {
    const result = await api.post("/api/weather/notify", {});
    setMessage(result.sent ? `Sent (${result.log?.length || 0} deliveries).` : result.reason);
    reload();
  }

  async function onContactSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const body = new FormData(form);
    await api.post("/api/weather/contacts", {
      name: body.get("name"),
      personId: body.get("personId") || null,
      email: body.get("email"),
      whatsapp: body.get("whatsapp"),
      notifyEmail: body.get("notifyEmail") === "on",
      notifyWhatsapp: body.get("notifyWhatsapp") === "on",
    });
    form.reset();
    setMessage("Contact added.");
    reload();
  }

  async function onGroupSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const body = new FormData(form);
    const contactIds = [...form.querySelectorAll('input[name="contactId"]:checked')].map((el) => Number(el.value));
    await api.post("/api/weather/groups", { name: body.get("name"), contactIds });
    form.reset();
    setMessage("Group created.");
    reload();
  }

  async function removeContact(id) {
    await fetch(`/api/weather/contacts/${id}`, { method: "DELETE" });
    reload();
  }

  async function removeGroup(id) {
    await fetch(`/api/weather/groups/${id}`, { method: "DELETE" });
    reload();
  }

  return (
    <>
      <PageHeader
        title="Weather alerts · SOP-59"
        lede="Auto email and WhatsApp when wind, rain, or WBGT ≥42°C is exceeded. The message names the reading and the instruction for that condition."
        actions={
          <a className="button" href="/api/weather/report.xlsx">
            Download weather report
          </a>
        }
      />
      {error ? <Banner>{error}</Banner> : null}
      {message ? <p className="banner info">{message}</p> : null}

      {settings ? (
        <section className="form-card">
          <h2>Auto-notify</h2>
          <p className="lede">
            {settings.autoNotify ? "On." : "Off."} Sends only on a new exceedance: wind ≥32 km/h, rain ≥2.5 mm/h, WBGT ≥42°C.
          </p>
          <div className="form-actions">
            <button type="button" className="button" onClick={toggleAutoNotify}>
              {settings.autoNotify ? "Turn off" : "Turn on"}
            </button>
            <button type="button" className="button secondary" onClick={notifyNow}>
              Notify now
            </button>
          </div>
          {alertMessage ? (
            <pre className="alert-copy">{alertMessage}</pre>
          ) : (
            <p className="quiet">No caution in force. Wind, rain, and WBGT are inside limits.</p>
          )}
        </section>
      ) : null}

      <section className="block">
        <h2>Users</h2>
        <p className="quiet">Each person can download their SOP-59 weather report. Add a contact to include them on email or WhatsApp alerts.</p>
        <ul className="weather-list">
          {users.map((user) => (
            <li key={user.key} className="weather-user">
              <div>
                <strong>{user.name}</strong>
                <span className="quiet">
                  {" "}
                  · {user.detail}
                  {user.contact ? ` · ${channelLabel(user.contact)}` : ""}
                </span>
              </div>
              <span className="weather-user-actions">
                <a className="button secondary" href={user.reportHref}>
                  Download report
                </a>
                {user.contact ? (
                  <button type="button" className="button ghost" onClick={() => removeContact(user.contact.id)}>
                    Remove
                  </button>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="form-card">
        <h2>Add to alerts</h2>
        <form className="form-grid" onSubmit={onContactSubmit}>
          <label>
            <span>Name</span>
            <input name="name" required />
          </label>
          <label>
            <span>Directory</span>
            <select name="personId" defaultValue="">
              <option value="">Manual</option>
              {meta.people.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Email</span>
            <input name="email" type="email" />
          </label>
          <label>
            <span>WhatsApp</span>
            <input name="whatsapp" placeholder="+9665…" />
          </label>
          <label className="wide chip-row">
            <span>Send by</span>
            <span>
              <label className="inline">
                <input type="checkbox" name="notifyEmail" defaultChecked /> Email
              </label>
              <label className="inline">
                <input type="checkbox" name="notifyWhatsapp" /> WhatsApp
              </label>
            </span>
          </label>
          <p className="form-actions wide">
            <button type="submit" className="button">
              Add
            </button>
          </p>
        </form>
      </section>

      <section className="form-card">
        <h2>WhatsApp group</h2>
        <p className="lede">
          Save the invite. Auto sending writes the live board — pin <a href="/weather/board">/weather/board</a> in the group. No WhatsApp login.
        </p>
        <form className="form-grid" onSubmit={saveWhatsAppGroup}>
          <label>
            <span>Group name</span>
            <input value={groupName} onChange={(event) => setGroupName(event.target.value)} placeholder="Yard HSE" />
          </label>
          <label className="wide">
            <span>Invite or webhook</span>
            <input
              value={groupInvite}
              onChange={(event) => setGroupInvite(event.target.value)}
              placeholder="https://chat.whatsapp.com/…"
              inputMode="url"
            />
          </label>
          <p className="form-actions wide">
            <button type="submit" className="button">
              Save
            </button>
          </p>
        </form>
      </section>

      <section className="form-card">
        <h2>Alert groups</h2>
        <form onSubmit={onGroupSubmit}>
          <label>
            <span>Name</span>
            <input name="name" required />
          </label>
          <fieldset className="group-pick">
            <legend>Members</legend>
            {contacts.length === 0 ? <p className="quiet">Add contacts first.</p> : null}
            {contacts.map((contact) => (
              <label key={contact.id} className="inline">
                <input type="checkbox" name="contactId" value={contact.id} /> {contact.name}
              </label>
            ))}
          </fieldset>
          <p className="form-actions">
            <button type="submit" className="button">
              Create group
            </button>
          </p>
        </form>
        {groups.length ? (
          <ul className="weather-list">
            {groups.map((group) => (
              <li key={group.id}>
                <strong>{group.name}</strong>
                <span className="quiet"> · {group.contactIds.length}</span>
                <button type="button" className="button ghost" onClick={() => removeGroup(group.id)}>
                  Remove
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section className="block">
        <h2>Log</h2>
        {notifications.length === 0 ? <p className="quiet">Nothing sent yet.</p> : null}
        <ul className="timeline">
          {notifications.map((row) => (
            <li key={row.id}>
              <strong>
                {row.prevLevel || "—"} → {row.newLevel}
              </strong>
              {row.manual ? " (manual)" : ""}
              <br />
              <span className="quiet">{row.createdAt}</span>
              {row.summary ? <pre className="alert-copy">{row.summary}</pre> : null}
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
