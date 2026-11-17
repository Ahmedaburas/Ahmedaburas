import { Link } from "react-router-dom";
import { SEVERITY_TONE, STATUS_TONE, statusLabel, useDocumentTitle } from "./format.js";

export function PageHeader({ title, lede, actions }) {
  useDocumentTitle(title);
  return (
    <header className="page-head">
      <div className="page-head-row">
        <div>
          <h1>{title}</h1>
          {lede ? <p className="lede">{lede}</p> : null}
        </div>
        {actions ? <div className="page-actions">{actions}</div> : null}
      </div>
    </header>
  );
}

export function Banner({ tone = "bad", children }) {
  if (!children) return null;
  return (
    <p className={`banner ${tone}`} role="alert">
      {children}
    </p>
  );
}

export function Badge({ tone = "neutral", children }) {
  return <span className={`badge ${tone}`}>{children}</span>;
}

export function StatusBadge({ meta, status }) {
  return <Badge tone={STATUS_TONE[status] || "neutral"}>{statusLabel(meta, status)}</Badge>;
}

export function SeverityBadge({ label, code }) {
  return <Badge tone={SEVERITY_TONE[code] || "neutral"}>{label}</Badge>;
}

export function Empty({ children }) {
  return <p className="empty">{children}</p>;
}

export function Back({ to, children }) {
  return (
    <Link className="back" to={to}>
      {children}
    </Link>
  );
}
