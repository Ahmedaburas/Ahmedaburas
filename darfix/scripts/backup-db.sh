#!/usr/bin/env bash
# Demo SQLite backup for DARFIX.
# Production: migrate to Postgres and use automated snapshots + PITR.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DATA_DIR="${DARFIX_DATA_DIR:-$ROOT/data}"
SRC="$DATA_DIR/darfix.sqlite"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
DEST_DIR="${DARFIX_BACKUP_DIR:-$DATA_DIR/backups}"
DEST="$DEST_DIR/darfix-$STAMP.sqlite"

mkdir -p "$DEST_DIR"

if [[ ! -f "$SRC" ]]; then
  echo "ERROR: database not found at $SRC" >&2
  exit 1
fi

# Prefer sqlite3 online backup when available (safer with WAL).
if command -v sqlite3 >/dev/null 2>&1; then
  sqlite3 "$SRC" ".backup '$DEST'"
else
  cp -f "$SRC" "$DEST"
  for suffix in -wal -shm; do
    if [[ -f "${SRC}${suffix}" ]]; then
      cp -f "${SRC}${suffix}" "${DEST}${suffix}"
    fi
  done
fi

echo "Backup written: $DEST"

# Optional restore helper (documented — does not run):
#   cp "$DEST" "$SRC"
#   # stop API first; then restart so WAL is consistent
