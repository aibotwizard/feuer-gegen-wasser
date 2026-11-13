#!/usr/bin/env bash
# deploy.sh — ship babylon-game/ to the pok.app VM, where Caddy serves it as
# static files at https://pok.app/nite/
#
#   bash deploy/deploy.sh              # full deploy
#   DRY_RUN=1 bash deploy/deploy.sh    # show what would transfer, change nothing
#   SKIP_TESTS=1 bash deploy/deploy.sh # skip the local gate (don't)
#
# Shape of the thing: NO process of our own. The game is plain HTML + JS with no
# build step, so Caddy (already on the box for Banana World, owning :80/:443)
# serves the files straight from /var/www/nite. There is no systemd unit, no
# port, no npm install and no database. See docs/DEPLOYMENT.md.
#
# Banana World owns the host pok.app and its /etc/caddy/Caddyfile, which its own
# deploy overwrites. We own exactly one file on the server, /etc/caddy/sites/nite.caddy,
# which that Caddyfile imports (the one-time "step 0" hand-off). This script
# refuses to run until that import line exists, so nothing can be half-installed.

set -euo pipefail

HOST="${HOST:-opc@144.24.239.85}"
SITE_DIR="${SITE_DIR:-/var/www/nite}"
# What the public hits. Must match deploy/nite.caddy — the final check fetches it.
PUBLIC_URL="${PUBLIC_URL:-https://pok.app/nite}"
# Banana World's front page. Our deploy restarts Caddy; it must come back too.
NEIGHBOUR_URL="${NEIGHBOUR_URL:-https://pok.app}"
DRY_RUN="${DRY_RUN:-}"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

# macOS rsync otherwise litters the VM with AppleDouble "._" files.
export COPYFILE_DISABLE=1

say() { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }
die() { printf '\n\033[1;31mFAIL: %s\033[0m\n' "$*" >&2; exit 1; }

rsync_flags=(-az --delete --exclude='._*' --exclude='.DS_Store')
[[ -n "$DRY_RUN" ]] && rsync_flags+=(--dry-run -v)

# ── 1. local gate ──────────────────────────────────────────────────────────
# Plain JS, so "typecheck" is a syntax check of every script the page loads.
if [[ -z "${SKIP_TESTS:-}" ]]; then
  say "syntax check"
  for f in $(grep -oE '<script src="[^"]+"' babylon-game/index.html | cut -d'"' -f2); do
    [[ -f "babylon-game/$f" ]] || die "index.html loads $f but it does not exist"
    [[ "$f" == babylon.js ]] && continue   # the vendored engine, 6 MB; not ours
    node --check "babylon-game/$f" || die "syntax error in $f — not deploying"
  done
  say "tests"
  (cd babylon-game && node tools/test.mjs >/dev/null 2>&1) || die "tests failed — not deploying"
fi

# There is no build: the files in babylon-game/ ARE the site. Just make sure the
# two things the page cannot live without are present.
[[ -f babylon-game/index.html ]] || die "babylon-game/index.html missing"
[[ -f babylon-game/babylon.js ]] || die "babylon-game/babylon.js missing"

# ── 2. reachability + preconditions (read-only) ────────────────────────────
say "checking $HOST"
ssh -o BatchMode=yes -o ConnectTimeout=10 "$HOST" true || die "cannot ssh to $HOST"

# Step 0 of the hosting brief: Banana World's Caddyfile must import our site
# file, or it would sit on the box doing nothing and be wiped by their deploy.
say "checking that /etc/caddy/Caddyfile imports /etc/caddy/sites/*.caddy"
ssh -o BatchMode=yes "$HOST" "grep -qE '^[[:space:]]*import[[:space:]]+/etc/caddy/sites/\*\.caddy' /etc/caddy/Caddyfile" \
  || die "step 0 not done: /etc/caddy/Caddyfile on the VM has no 'import /etc/caddy/sites/*.caddy' line.
      Add that line to deploy/oci/Caddyfile in the Banana World repo and deploy it (npm run deploy there), then rerun."

# ── 3. the site directory ──────────────────────────────────────────────────
# One-time, idempotent. /var/www/... is httpd_sys_content_t by default policy,
# so files rsync'd in as opc get the right SELinux label with no chcon. The
# directory is owned by opc so rsync needs no sudo.
if ssh -o BatchMode=yes "$HOST" "test -d $SITE_DIR"; then
  echo "$SITE_DIR exists"
elif [[ -n "$DRY_RUN" ]]; then
  echo "DRY_RUN: would create $SITE_DIR (owner opc)"
else
  say "creating $SITE_DIR"
  ssh -o BatchMode=yes "$HOST" "sudo mkdir -p $SITE_DIR && sudo chown opc:opc $SITE_DIR"
fi

# ── 4. sync ────────────────────────────────────────────────────────────────
# tools/ is the local test and balance harness; the browser never loads it.
# --delete keeps the server an exact mirror, so renamed files do not pile up.
say "syncing babylon-game/ -> $HOST:$SITE_DIR/"
rsync "${rsync_flags[@]}" --exclude='/tools/' --chmod=u=rwX,go=rX \
  babylon-game/ "$HOST:$SITE_DIR/"

say "staging the Caddy site block"
rsync "${rsync_flags[@]}" deploy/nite.caddy "$HOST:/tmp/nite.caddy"

if [[ -n "$DRY_RUN" ]]; then
  say "DRY_RUN set — stopping before any remote change"
  exit 0
fi

# ── 5. remote: labels, Caddy site block ────────────────────────────────────
say "remote: SELinux labels, Caddy site block"
ssh -o BatchMode=yes "$HOST" SITE_DIR="$SITE_DIR" 'bash -seuo pipefail' <<'REMOTE'
echo "--- SELinux labels under $SITE_DIR ---"
# Default policy already labels /var/www/* as web content; restorecon makes
# that true for anything that arrived with a stray label.
sudo restorecon -R "$SITE_DIR"
ls -ldZ "$SITE_DIR" "$SITE_DIR/index.html" | sed 's/^/  /'

echo "--- Caddy site block ---"
sudo mkdir -p /etc/caddy/sites
site=/etc/caddy/sites/nite.caddy
if sudo cmp -s /tmp/nite.caddy "$site"; then
  echo "site block unchanged; Caddy not restarted"
else
  # Validate BEFORE restarting, and put the old file back if the new one is
  # bad: a broken import would stop Caddy — and Banana World — from starting
  # the next time anything restarts it.
  if sudo test -f "$site"; then sudo cp "$site" /tmp/nite.caddy.prev; else rm -f /tmp/nite.caddy.prev; fi
  sudo cp /tmp/nite.caddy "$site"
  if ! sudo caddy validate --config /etc/caddy/Caddyfile >/tmp/nite.validate 2>&1; then
    if [[ -f /tmp/nite.caddy.prev ]]; then sudo cp /tmp/nite.caddy.prev "$site"; else sudo rm -f "$site"; fi
    echo "CADDY CONFIG INVALID — previous site block restored, Caddy NOT restarted:"
    cat /tmp/nite.validate
    rm -f /tmp/nite.caddy /tmp/nite.caddy.prev /tmp/nite.validate
    exit 1
  fi
  # restart, not reload: the Caddyfile sets `admin off` (SELinux denies the admin
  # socket), and reload drives the admin API. Banana World's websockets drop for
  # a second; its clients reconnect.
  sudo systemctl restart caddy
  echo "site block installed + Caddy restarted"
fi
rm -f /tmp/nite.caddy /tmp/nite.caddy.prev /tmp/nite.validate
REMOTE

# ── 6. prove it from outside ───────────────────────────────────────────────
# No -k anywhere: an invalid certificate must fail the deploy, not be waved through.
say "verifying from the public internet"
# Polled: after a Caddy restart the first requests can fail while it comes up.
code=""
for _ in $(seq 1 15); do
  code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 25 "$PUBLIC_URL/")"
  [[ "$code" == "200" ]] && break
  sleep 2
done
[[ "$code" == "200" ]] || die "GET $PUBLIC_URL/ returned $code (still, after ~30s of retries)"

# 200 alone proves nothing: Banana World answers 200 for any path. The bytes
# served must be exactly the index.html we have here, and a nested file must
# come through the prefix strip too.
curl -s --max-time 25 "$PUBLIC_URL/" | cmp -s - babylon-game/index.html \
  || die "$PUBLIC_URL/ is not serving our index.html — the /nite block is not taking effect"
curl -s --max-time 25 "$PUBLIC_URL/js/main.js" | cmp -s - babylon-game/js/main.js \
  || die "$PUBLIC_URL/js/main.js does not match babylon-game/js/main.js"
echo "  $PUBLIC_URL/ serves the index.html we just synced"

# /nite must bounce to /nite/ (relative script URLs depend on the slash).
redirect="$(curl -s -o /dev/null -w '%{redirect_url}' --max-time 20 "$PUBLIC_URL")"
[[ "$redirect" == "$PUBLIC_URL/" ]] || die "$PUBLIC_URL did not redirect to $PUBLIC_URL/ (got '${redirect:-nothing}')"
echo "  $PUBLIC_URL -> $redirect"

# http must redirect to https.
http_url="http://${PUBLIC_URL#https://}/"
redirect="$(curl -s -o /dev/null -w '%{redirect_url}' --max-time 20 "$http_url")"
[[ "$redirect" == https://* ]] || die "$http_url did not redirect to https (got '${redirect:-nothing}')"
echo "  $http_url -> $redirect"

# Our Caddy restart must never be the reason Banana World is down.
code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 25 "$NEIGHBOUR_URL/")"
[[ "$code" == "200" ]] || die "$NEIGHBOUR_URL/ returned $code after our Caddy restart — Banana World is NOT ok"
echo "  $NEIGHBOUR_URL/ still 200"

say "memory on the VM (we add no process; this is for the record)"
ssh -o BatchMode=yes "$HOST" 'free -m'

say "deployed: $PUBLIC_URL/"
