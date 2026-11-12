import { useEffect, useState } from "react";
import { NavLink, Outlet, Route, Routes, useLocation } from "react-router-dom";
import { useFetch } from "./api.js";
import { MetaContext } from "./meta.js";
import { MODULES, NAV } from "./modules.js";
import { Browse } from "./pages/Browse.jsx";
import { CreateForm } from "./pages/Create.jsx";
import { Dashboard } from "./pages/Dashboard.jsx";
import { Directory } from "./pages/Directory.jsx";
import { RecordView } from "./pages/Record.jsx";
import { PageHeader } from "./ui.jsx";

function MetaGate({ children }) {
  const state = useFetch("/api/meta");
  if (!state.data && state.loading) return <p className="boot">Loading the HSE platform…</p>;
  if (!state.data) {
    return (
      <p className="boot">
        Cannot reach the HSE service. From the project folder run <code>npm run dev</code>, then refresh.
        {state.error ? ` ${state.error}` : ""}
      </p>
    );
  }
  return <MetaContext.Provider value={state.data}>{children}</MetaContext.Provider>;
}

function Layout() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  useEffect(() => setOpen(false), [location.pathname]);
  useEffect(() => {
    function onKey(event) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="app">
      {open ? (
        <button type="button" className="backdrop" aria-label="Close menu" onClick={() => setOpen(false)} />
      ) : null}
      <aside id="nav" className={open ? "sidebar open" : "sidebar"}>
        <NavLink to="/" className="brand" end>
          <span className="mark" aria-hidden="true">
            HSE
          </span>
          <span>
            <strong>Field safety</strong>
            <small>Reporting platform</small>
          </span>
        </NavLink>
        <nav aria-label="Modules">
          {NAV.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end}>
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className="workspace">
        <div className="topbar">
          <button
            type="button"
            className="menu-btn"
            aria-expanded={open}
            aria-controls="nav"
            onClick={() => setOpen((value) => !value)}
          >
            Menu
          </button>
          <span>HSE platform</span>
        </div>
        <main id="content" className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function NotFound() {
  return (
    <>
      <PageHeader title="Page not found" lede="That address is not part of this platform." />
      <NavLink to="/">Back to the dashboard</NavLink>
    </>
  );
}

export function App() {
  return (
    <MetaGate>
      <a className="skip" href="#content">
        Skip to content
      </a>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="directory" element={<Directory />} />
          {Object.entries(MODULES).flatMap(([key, module]) => {
            const base = module.path.slice(1);
            return [
              <Route key={`${key}-list`} path={base} element={<Browse moduleKey={key} />} />,
              module.create ? <Route key={`${key}-new`} path={`${base}/new`} element={<CreateForm moduleKey={key} />} /> : null,
              <Route key={`${key}-record`} path={`${base}/:id`} element={<RecordView moduleKey={key} />} />,
            ].filter(Boolean);
          })}
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </MetaGate>
  );
}
