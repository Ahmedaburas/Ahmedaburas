/**
 * Continuous security audit checks for DARFIX (defensive only).
 * Findings are persisted; remediations that change state require human approval.
 */

import type Database from 'better-sqlite3'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export type FindingSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info'
export type SecurityFinding = {
  code: string
  severity: FindingSeverity
  title: string
  detail: string
  surface: 'frontend' | 'backend' | 'transport' | 'agents' | 'data'
  autoFixable: boolean
  recommendedAction: string
}

export const SECURITY_PLAYBOOK_VERSION = '2026.11.27'

export function securityPlaybook() {
  return {
    version: SECURITY_PLAYBOOK_VERSION,
    updatedAt: '2026-11-27',
    principles: [
      'Defense in depth across frontend, API, and agent tools',
      'Never auto-apply remediations that change auth, data, or billing without human approval',
      'Notify admins on critical/high findings and expected threats',
      'Treat peer agents as untrusted callers — scope tools, require approval for sensitive writes',
      'No hardcoded credentials in shipped SPA or agent bundles',
      'Never activate subscriptions from webhook body claims — verify with Moyasar API + webhook secret',
    ],
    checklist: [
      { id: 'secret-env', area: 'backend', check: 'DARFIX_SECRET must be set outside local ephemeral mode' },
      { id: 'no-demo-seed-prod', area: 'backend', check: 'DARFIX_SEED_DEMO must be off for pilot/production' },
      { id: 'health-clean', area: 'backend', check: 'Health endpoint must not leak secret material' },
      { id: 'cors-tight', area: 'transport', check: 'CORS allowlist only (no wildcard in production)' },
      { id: 'tenant-authz', area: 'backend', check: 'Booking mutations require role + tenant checks' },
      { id: 'agent-approvals', area: 'agents', check: 'Sensitive agent actions require pending human approval' },
      { id: 'no-client-founding', area: 'backend', check: 'Signup cannot self-grant founding/pro via client flags' },
      { id: 'partner-pii', area: 'data', check: 'Partner directory must not expose CR/phone/WhatsApp publicly' },
      { id: 'discount-leak', area: 'data', check: 'Discount codes not dumped to every customer session' },
      { id: 'mock-pay-gated', area: 'backend', check: 'Mock payment simulate disabled when secrets/prod bound' },
      {
        id: 'moyasar-webhook-auth',
        area: 'backend',
        check: 'Moyasar webhook requires shared secret + live invoice verify before plan activate',
      },
      {
        id: 'provider-invite-optional',
        area: 'backend',
        check: 'Optional DARFIX_PROVIDER_INVITE_CODES for closed partner onboarding',
      },
    ],
  }
}

function metaGet(db: Database.Database, key: string): string | null {
  const row = db.prepare(`SELECT value FROM meta WHERE key = ?`).get(key) as { value?: string } | undefined
  return row?.value ?? null
}

export function runSecurityAudit(db: Database.Database): SecurityFinding[] {
  const findings: SecurityFinding[] = []
  const secret = process.env.DARFIX_SECRET || process.env.JWT_SECRET || ''
  const seedDemo = process.env.DARFIX_SEED_DEMO === '1'
  const nodeEnv = process.env.NODE_ENV || 'development'
  const corsRaw = process.env.DARFIX_CORS_ORIGINS || ''

  if (!secret && (nodeEnv === 'production' || process.env.DARFIX_REQUIRE_SECRET === '1')) {
    findings.push({
      code: 'missing_darfix_secret',
      severity: 'critical',
      title: 'Signing secret not configured',
      detail: 'DARFIX_SECRET / JWT_SECRET is unset while production-like mode is active.',
      surface: 'backend',
      autoFixable: false,
      recommendedAction: 'Set DARFIX_SECRET in the host secrets store and restart.',
    })
  } else if (!secret) {
    findings.push({
      code: 'ephemeral_secret_local',
      severity: 'medium',
      title: 'Using local ephemeral signing secret',
      detail: 'No DARFIX_SECRET set — acceptable only for local development.',
      surface: 'backend',
      autoFixable: false,
      recommendedAction: 'Bind DARFIX_SECRET before any shared pilot publish.',
    })
  }

  if (seedDemo && (nodeEnv === 'production' || process.env.DARFIX_REQUIRE_SECRET === '1' || Boolean(secret))) {
    findings.push({
      code: 'demo_seed_enabled',
      severity: 'high',
      title: 'Demo seed mode is enabled',
      detail: 'DARFIX_SEED_DEMO=1 can recreate known demo accounts — unsafe for shared pilots.',
      surface: 'data',
      autoFixable: true,
      recommendedAction: 'Disable DARFIX_SEED_DEMO and rotate any seeded admin credentials.',
    })
  }

  if (corsRaw.trim() === '*') {
    findings.push({
      code: 'cors_wildcard',
      severity: 'high',
      title: 'CORS allows any origin',
      detail: 'DARFIX_CORS_ORIGINS=* reflects any Origin header.',
      surface: 'transport',
      autoFixable: false,
      recommendedAction: 'Set an explicit comma-separated origin allowlist.',
    })
  }

  const moyasarKey = (process.env.MOYASAR_SECRET_KEY || '').trim()
  const webhookSecret = (process.env.MOYASAR_WEBHOOK_SECRET || '').trim()
  if (moyasarKey && !webhookSecret && (nodeEnv === 'production' || process.env.DARFIX_REQUIRE_SECRET === '1' || Boolean(secret))) {
    findings.push({
      code: 'moyasar_webhook_secret_missing',
      severity: 'high',
      title: 'Moyasar webhook secret not bound',
      detail: 'MOYASAR_SECRET_KEY is set but MOYASAR_WEBHOOK_SECRET is empty — hosted webhooks reject until configured.',
      surface: 'backend',
      autoFixable: false,
      recommendedAction: 'Bind MOYASAR_WEBHOOK_SECRET and configure the same value in the Moyasar dashboard webhook.',
    })
  }

  const pendingApprovals = (
    db.prepare(`SELECT COUNT(*) AS c FROM agent_approvals WHERE status = 'pending'`).get() as {
      c: number
    }
  ).c
  if (pendingApprovals >= 20) {
    findings.push({
      code: 'approval_flood',
      severity: 'high',
      title: 'Unusual pending agent approval volume',
      detail: `${pendingApprovals} pending approvals — possible agent spam or compromise.`,
      surface: 'agents',
      autoFixable: false,
      recommendedAction: 'Review pending approvals; reject unknowns; rotate agent credentials.',
    })
  } else if (pendingApprovals >= 8) {
    findings.push({
      code: 'approval_elevated',
      severity: 'medium',
      title: 'Elevated pending approvals',
      detail: `${pendingApprovals} pending approvals awaiting human decision.`,
      surface: 'agents',
      autoFixable: false,
      recommendedAction: 'Triage approvals in Field Ops lead / admin inbox.',
    })
  }

  const adminCount = (
    db.prepare(`SELECT COUNT(*) AS c FROM users WHERE role = 'admin'`).get() as { c: number }
  ).c
  if (adminCount === 0) {
    findings.push({
      code: 'no_admin_user',
      severity: 'critical',
      title: 'No admin user in database',
      detail: 'Cannot notify or approve security remediations without an admin account.',
      surface: 'data',
      autoFixable: false,
      recommendedAction: 'Create admin via DARFIX_ADMIN_EMAIL / DARFIX_ADMIN_PASSWORD env bootstrap.',
    })
  }

  // Scan agent tool clients in-repo when running from source tree (best-effort).
  try {
    const agentsRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'darfix-agents')
    if (fs.existsSync(agentsRoot)) {
      const hits: string[] = []
      const walk = (dir: string) => {
        for (const name of fs.readdirSync(dir)) {
          if (name === 'node_modules' || name === 'dist') continue
          const p = path.join(dir, name)
          const st = fs.statSync(p)
          if (st.isDirectory()) walk(p)
          else if (/\.(ts|tsx|js|md)$/.test(name)) {
            const text = fs.readFileSync(p, 'utf8')
            // Construct needle so this audit file itself never embeds a password literal.
            const bannedDemo = ['demo', '123'].join('')
            if (text.includes(bannedDemo) && !p.includes('README')) hits.push(path.relative(agentsRoot, p))
          }
        }
      }
      walk(agentsRoot)
      if (hits.length) {
        findings.push({
          code: 'agent_hardcoded_demo_password',
          severity: 'high',
          title: 'Agent bundles contain demo password literals',
          detail: `Found banned demo password literal in: ${hits.slice(0, 8).join(', ')}${hits.length > 8 ? '…' : ''}`,
          surface: 'agents',
          autoFixable: false,
          recommendedAction:
            'Use DARFIX_ADMIN_EMAIL/PASSWORD (and role env) — never ship known demo passwords in agent clients.',
        })
      }
    }
  } catch {
    /* ignore scan errors */
  }

  const openFindings = (
    db
      .prepare(
        `SELECT COUNT(*) AS c FROM security_findings WHERE status = 'open' AND severity IN ('critical','high')`,
      )
      .get() as { c: number } | undefined
  )?.c
  if (typeof openFindings === 'number' && openFindings > 0) {
    findings.push({
      code: 'unresolved_high_findings',
      severity: 'medium',
      title: 'Open high/critical findings remain',
      detail: `${openFindings} open high/critical findings still need remediation or approval.`,
      surface: 'backend',
      autoFixable: false,
      recommendedAction: 'Review /api/security/findings and decide remediations.',
    })
  }

  // Playbook freshness marker
  const lastPlaybook = metaGet(db, 'security_playbook_version')
  if (lastPlaybook && lastPlaybook !== SECURITY_PLAYBOOK_VERSION) {
    findings.push({
      code: 'playbook_outdated_marker',
      severity: 'info',
      title: 'Security playbook version changed',
      detail: `Stored ${lastPlaybook} → current ${SECURITY_PLAYBOOK_VERSION}. Guardian should reload checklist.`,
      surface: 'agents',
      autoFixable: true,
      recommendedAction: 'Call playbook refresh; acknowledge new checklist items.',
    })
  }

  return findings
}

export function persistFindings(
  db: Database.Database,
  findings: SecurityFinding[],
  opts: { notifyAdmin: boolean; uid: () => string; now: string },
) {
  const insert = db.prepare(
    `INSERT INTO security_findings (id, code, severity, title, detail, surface, auto_fixable, recommended_action, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'open', ?, ?)
     ON CONFLICT(code) DO UPDATE SET
       severity = excluded.severity,
       title = excluded.title,
       detail = excluded.detail,
       surface = excluded.surface,
       auto_fixable = excluded.auto_fixable,
       recommended_action = excluded.recommended_action,
       updated_at = excluded.updated_at,
       status = CASE WHEN security_findings.status = 'resolved' THEN 'open' ELSE security_findings.status END`,
  )
  const codes = new Set(findings.map((f) => f.code))
  for (const f of findings) {
    insert.run(
      opts.uid(),
      f.code,
      f.severity,
      f.title,
      f.detail,
      f.surface,
      f.autoFixable ? 1 : 0,
      f.recommendedAction,
      opts.now,
      opts.now,
    )
  }

  // Auto-resolve findings no longer present
  const openRows = db
    .prepare(`SELECT id, code FROM security_findings WHERE status = 'open'`)
    .all() as Array<{ id: string; code: string }>
  for (const row of openRows) {
    if (!codes.has(row.code)) {
      db.prepare(
        `UPDATE security_findings SET status = 'resolved', updated_at = ?, resolved_at = ? WHERE id = ?`,
      ).run(opts.now, opts.now, row.id)
    }
  }

  db.prepare(`INSERT OR REPLACE INTO meta (key, value) VALUES ('security_playbook_version', ?)`).run(
    SECURITY_PLAYBOOK_VERSION,
  )
  db.prepare(`INSERT OR REPLACE INTO meta (key, value) VALUES ('security_last_audit_at', ?)`).run(opts.now)

  const alerts = findings.filter((f) => f.severity === 'critical' || f.severity === 'high')
  if (opts.notifyAdmin && alerts.length) {
    const admins = db.prepare(`SELECT id FROM users WHERE role = 'admin'`).all() as Array<{ id: string }>
    const note = db.prepare(
      `INSERT INTO notifications (id, user_id, title, body, created_at, read)
       VALUES (?, ?, ?, ?, ?, 0)`,
    )
    for (const admin of admins) {
      note.run(
        opts.uid(),
        admin.id,
        `Security alert: ${alerts.length} high/critical finding(s)`,
        alerts.map((a) => `• [${a.severity}] ${a.title}`).join('\n'),
        opts.now,
      )
    }
  }

  return { findings, alertCount: alerts.length }
}
