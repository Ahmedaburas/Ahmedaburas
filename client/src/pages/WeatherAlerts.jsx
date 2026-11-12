import { useCallback, useEffect, useState } from "react";
import { api, request } from "../api.js";
import { useMeta } from "../meta.js";
import { Banner, PageHeader } from "../ui.jsx";

export function WeatherAlerts() {
  const meta = useMeta();
  const [settings, setSettings] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [groups, setGroups] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [alertMessage, setAlertMessage] = useState("");
  const [groupName, setGroupName] = useState("");
  const [groupWebhook, setGroupWebhook] = useState("");
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
      setGroupWebhook(s.whatsappGroupWebhook || "");
      setError("");
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  async function toggleAutoNotify() {
    const next = await request("/api/weather/settings", {
      method: "PUT",
      body: JSON.stringify({ autoNotify: !settings.autoNotify }),
    });
    setSettings(next);
    setMessage(next.autoNotify ? "Auto-notify is on." : "Auto-notify is off.");
  }

  async function saveWhatsAppGroup(event) {
    event.preventDefault();
    try {
      const next = await api.put("/api/weather/settings", {
        whatsappGroupName: groupName,
        whatsappGroupWebhook: groupWebhook,
      });
      setSettings(next);
      setGroupName(next.whatsappGroupName || "");
      setGroupWebhook(next.whatsappGroupWebhook || "");
      setMessage(next.whatsappGroupWebhook ? "WhatsApp group linked. No personal WhatsApp sign-in is used." : "WhatsApp group link cleared.");
      setError("");
    } catch (err) {
      setError(err.message);
    }
  }

  async function notifyNow() {
    const result = await api.post("/api/weather/notify", {});
    setMessage(
      result.sent
        ? `Notify now completed (${result.log?.length || 0} delivery attempts).`
        : result.reason,
    );
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
        lede="Email and WhatsApp go out for wind and rain at the SOP-59 limits, and for heat only when WBGT reaches 42°C."
      />
      {error ? <Banner>{error}</Banner> : null}
      {message ? <p className="banner info">{message}</p> : null}
      {settings ? (
        <section className="form-card">
          <h2>Auto-notify</h2>
          <p className="lede">
            When on, a refresh sends an alert only if wind is at least 32 km/h, rain is at least 2.5 mm/h, or WBGT is at
            least 42°C, and only when that set changes. Ambient temperature alone does not send. At WBGT 42–50°C the message
            uses the Danger row: heavy workload, 50% work / 50% rest, restrict heavy work. Above 50°C it uses the Extreme
            Danger row: suspend outdoor work. Both require 4–6 cups of water per hour. Lightning, humidity, visibility, and
            feels-like do not send. SMTP and WhatsApp settings come from environment variables on the API host.
          </p>
          <div className="form-actions">
            <label className="toggle-row">
              <input type="checkbox" checked={settings.autoNotify} onChange={toggleAutoNotify} />
              <span>Auto-notify when wind, rain, or WBGT of 42°C or higher is exceeded</span>
            </label>
            <button type="button" className="button" onClick={notifyNow}>
              Notify now
            </button>
          </div>
          <h3>Safety instruction in the alert</h3>
          {alertMessage ? (
            <pre className="alert-copy">{alertMessage}</pre>
          ) : (
            <p className="quiet">
              No safety instruction. Wind and rain are inside their SOP-59 limits, and WBGT is under 42°C, so nothing is sent.
              When wind, rain, or WBGT of 42°C or higher is exceeded, the message names that reading and the instruction for
              that row.
            </p>
          )}
        </section>
      ) : null}

      <section className="form-card">
        <h2>WhatsApp group</h2>
        <p className="lede">
          Alerts are posted to the group through a webhook. This app does not sign in to your personal WhatsApp. Paste the
          webhook from the bot or automation that is already a member of the group. It receives JSON with a text field.
        </p>
        <form className="form-grid" onSubmit={saveWhatsAppGroup}>
          <label>
            <span>Group name</span>
            <input value={groupName} onChange={(event) => setGroupName(event.target.value)} placeholder="Yard HSE" />
          </label>
          <label className="wide">
            <span>Group webhook URL</span>
            <input
              value={groupWebhook}
              onChange={(event) => setGroupWebhook(event.target.value)}
              placeholder="https://hooks.example/whatsapp-group"
              inputMode="url"
            />
          </label>
          <p className="form-actions wide">
            <button type="submit" className="button">
              Save group link
            </button>
          </p>
        </form>
      </section>

      <section className="form-card">
        <h2>Add contact</h2>
        <form className="form-grid" onSubmit={onContactSubmit}>
          <label>
            <span>Name</span>
            <input name="name" required />
          </label>
          <label>
            <span>Link to person</span>
            <select name="personId" defaultValue="">
              <option value="">Manual entry</option>
              {meta.people.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.name} · {person.email}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Email</span>
            <input name="email" type="email" />
          </label>
          <label>
            <span>WhatsApp (E.164)</span>
            <input name="whatsapp" placeholder="+9665…" />
          </label>
          <label className="wide chip-row">
            <span>Channels</span>
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
              Add contact
            </button>
          </p>
        </form>
      </section>

      <section className="block">
        <h2>Contacts</h2>
        {contacts.length === 0 ? <p className="quiet">No alert contacts yet.</p> : null}
        <ul className="weather-list">
          {contacts.map((contact) => (
            <li key={contact.id}>
              <strong>{contact.name}</strong>
              {contact.email ? ` · ${contact.email}` : ""}
              {contact.whatsapp ? ` · ${contact.whatsapp}` : ""}
              <span className="quiet">
                {" "}
                ({contact.notifyEmail ? "email" : ""}
                {contact.notifyEmail && contact.notifyWhatsapp ? ", " : ""}
                {contact.notifyWhatsapp ? "whatsapp" : ""})
              </span>
              <button type="button" className="button ghost" onClick={() => removeContact(contact.id)}>
                Remove
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="form-card">
        <h2>Create group</h2>
        <form onSubmit={onGroupSubmit}>
          <label>
            <span>Group name</span>
            <input name="name" required />
          </label>
          <fieldset className="group-pick">
            <legend>Members</legend>
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
      </section>

      <section className="block">
        <h2>Groups</h2>
        {groups.length === 0 ? <p className="quiet">No groups yet.</p> : null}
        <ul className="weather-list">
          {groups.map((group) => (
            <li key={group.id}>
              <strong>{group.name}</strong>
              <span className="quiet"> · {group.contactIds.length} members</span>
              <button type="button" className="button ghost" onClick={() => removeGroup(group.id)}>
                Remove
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="block">
        <h2>Recent notifications</h2>
        {notifications.length === 0 ? <p className="quiet">No notifications logged yet.</p> : null}
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
              {row.delivery?.length ? (
                <ul>
                  {row.delivery.map((item, index) => (
                    <li key={index}>
                      {item.name} · {item.channel}: {item.ok ? "sent" : item.detail}
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
