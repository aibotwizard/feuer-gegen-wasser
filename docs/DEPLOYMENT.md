# Deployment: https://pok.app/nite/

The game (`babylon-game/`) is hosted on the same Oracle Cloud VM as Banana
World, under a **path** on Banana World's hostname rather than a hostname of
its own. It is plain HTML and JavaScript with no build step and no server
code, so Caddy serves the files directly. There is no Node process, no
systemd unit, no port, no database and no secrets.

| | |
|---|---|
| URL | `https://pok.app/nite/` (`/nite` redirects to `/nite/`) |
| VM | `opc@144.24.239.85`, Oracle Linux 9, SELinux enforcing, 945 MB RAM |
| Files on the VM | `/var/www/nite/` (owner `opc`), a mirror of `babylon-game/` minus `tools/` |
| Caddy site block | `/etc/caddy/sites/nite.caddy`, source of truth `deploy/nite.caddy` |
| Deploy command | `bash deploy/deploy.sh` from the repo root (`DRY_RUN=1` to only show what would transfer) |
| Port | none of ours. Caddy owns 80/443; Banana World's Node owns 8080 |
| Unit / env file | none |
| Logs | `sudo journalctl -u caddy -f` on the VM (requests to `pok.app` are logged by Banana World's site block, which covers `/nite/` too) |

## How the path hand-off works

Banana World owns `pok.app` and `/etc/caddy/Caddyfile`, and its deploy
overwrites that file. Its Caddyfile ends with

```
import /etc/caddy/sites/*.caddy
```

so each extra app owns one file in `/etc/caddy/sites/`. Ours is a site block
with a path in its address, `pok.app/nite*`. Caddy orders site blocks by
specificity, so this block is tried before the plain `pok.app` block (checked
with `caddy adapt` on the VM; the `/nite*` route sorts first). Inside it,
`handle_path /nite/*` strips the prefix and `file_server` serves
`/var/www/nite`. Nothing in Banana World's own block changes.

Caddy runs confined under SELinux (`httpd_t`) and may not read `/home/opc`
(`httpd_enable_homedirs` is off). `/var/www/...` is labelled
`httpd_sys_content_t` by default policy, which is why the files live there and
why no `chcon` is needed. `deploy.sh` runs `restorecon -R` after each sync
anyway.

## What deploy.sh does, in order

1. Local gate: `node --check` on every script `index.html` loads (except the
   vendored `babylon.js`), then `node tools/test.mjs`. Aborts on failure.
2. Checks `index.html` and `babylon.js` exist. There is no build.
3. `ssh` reachability check.
4. Refuses to continue unless the VM's `/etc/caddy/Caddyfile` contains the
   `import /etc/caddy/sites/*.caddy` line (step 0 of the hosting brief).
5. Creates `/var/www/nite` (owner `opc`) if missing.
6. `rsync -az --delete` of `babylon-game/` into `/var/www/nite/`, excluding
   `tools/`, `._*` and `.DS_Store`; stages `deploy/nite.caddy` in `/tmp`.
   `DRY_RUN=1` stops here, after an `rsync --dry-run -v` listing.
7. On the VM: `restorecon -R`, then installs the site block only if it
   changed. It validates the full Caddy config first and, if validation fails,
   puts the previous site block back and exits 1 without restarting Caddy.
   On success it runs `systemctl restart caddy` (`reload` cannot work here:
   Caddy runs with `admin off`). Banana World's websockets drop for about a
   second and reconnect.
8. Verifies from the public internet with no `curl -k`: polls
   `https://pok.app/nite/` for up to ~30 s until 200, byte-compares the served
   `index.html` and `js/main.js` with the local files (a bare 200 is not
   enough, Banana World answers 200 for any path), checks `/nite` redirects
   to `/nite/`, checks `http://` redirects to `https://`, and checks
   `https://pok.app/` still returns 200.
9. Prints `free -m` for the record. We add no process, so memory should not move.

## Backup and restore

There is no state on the VM. The repo is the backup. To restore or roll back,
check out the wanted commit and run `bash deploy/deploy.sh`. To remove the
site entirely:

```bash
ssh opc@144.24.239.85 'sudo rm /etc/caddy/sites/nite.caddy && sudo caddy validate --config /etc/caddy/Caddyfile && sudo systemctl restart caddy && sudo rm -rf /var/www/nite'
```

## Constraints inherited from the VM

- Never build on the VM (945 MB RAM). This app has nothing to build anyway.
- Do not touch anything of Banana World's: port 8080, `/home/opc/app/`,
  `/etc/banana-world.env`, `/etc/caddy/Caddyfile`, the hostnames `pok.app`,
  `www.pok.app`, `144-24-239-85.sslip.io`.
- If this app ever grows a server process: `User=opc`, bind `127.0.0.1`,
  use port 10001 (SELinux `http_cache_port_t`; 9000, 8008, 8009, 8443,
  10002 to 10010 are the free alternatives), `MemoryMax=200M`, secrets in a
  root-owned `/etc/nite.env` with mode 600. The brief for this is in the
  Banana World repo under `docs/`.
- `systemctl reload caddy` does not work on this box. Always `caddy validate`
  then `systemctl restart caddy`.

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `/nite/` shows Banana World instead of the game | The import line is missing from `/etc/caddy/Caddyfile` (a Banana World deploy from a branch without it would do this). Redo step 0 there, then rerun `deploy.sh`. |
| 403 on `/nite/` | SELinux label or permissions. `ls -ldZ /var/www/nite /var/www/nite/index.html` should show `httpd_sys_content_t`; `sudo restorecon -R /var/www/nite`. Files must be world-readable, dirs world-searchable. |
| Scripts 404 but the page loads | The page was opened as `/nite` without the slash and the redirect is missing. Check the `redir @bare` lines in the site block. |
| Caddy will not start after a Banana World deploy | Their Caddyfile and our site block disagree. `sudo caddy validate --config /etc/caddy/Caddyfile` names the line. |
| Old files still served | Browser cache. Caddy sends `ETag` and `Last-Modified`, so a reload revalidates; a hard reload clears it. |
