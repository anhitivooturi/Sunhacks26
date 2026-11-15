#!/usr/bin/env bash
set -euo pipefail
domain="${1:?Usage: bash deploy/deploy.sh pulse.example.com}"
if [[ ! "$domain" =~ ^[a-zA-Z0-9]([a-zA-Z0-9.-]*[a-zA-Z0-9])?\.[a-zA-Z]{2,}$ ]]; then
  echo 'Supply a domain name, without https:// or a path.' >&2
  exit 1
fi
cd "$(dirname "${BASH_SOURCE[0]}")/.."
for command in node npm pm2 caddy curl; do command -v "$command" >/dev/null || { echo "Install $command first (see DEPLOY.md)" >&2; exit 1; }; done
node -e 'if (+process.versions.node.split(".")[0] < 22) process.exit(1)'
run_app() { "$@"; }
admin() { sudo "$@"; }
app_user=""
if [[ "$EUID" -eq 0 ]]; then
  # Initial setup from Vultr's root login: keep the Node process unprivileged.
  case "$PWD" in /root|/root/*) echo 'Extract the backend to /srv/pulse/server/live first.' >&2; exit 1 ;; esac
  app_user="${PULSE_APP_USER:-pulse}"
  if [[ ! "$app_user" =~ ^[a-z_][a-z0-9_-]*$ || "$app_user" == root ]]; then
    echo 'PULSE_APP_USER must be a non-root Linux username.' >&2
    exit 1
  fi
  if ! id "$app_user" >/dev/null 2>&1; then useradd --system --create-home --shell /bin/bash "$app_user"; fi
  run_app() { runuser -u "$app_user" -- "$@"; }
  admin() { "$@"; }
fi
if [[ ! -f .env ]]; then cp .env.example .env; fi
chmod 600 .env
node --input-type=module - "$domain" <<'NODE'
import { readFileSync, writeFileSync } from 'node:fs';
let env = readFileSync('.env', 'utf8');
const values = { BASE_URL: `https://${process.argv[2]}`, HOST: '127.0.0.1' };
for (const [key, value] of Object.entries(values)) {
  const pattern = new RegExp(`^${key}=.*$`, 'm');
  env = pattern.test(env) ? env.replace(pattern, `${key}=${value}`) : `${env}\n${key}=${value}\n`;
}
writeFileSync('.env', env);
NODE
if [[ -n "$app_user" ]]; then chown -R "$app_user:$(id -gn "$app_user")" "$PWD"; fi
# Person B's modules have separate locks and resolve their own SDK dependencies.
for module in ../ai ../transcribe; do
  if [[ -f "$module/package-lock.json" ]]; then
    if [[ -n "$app_user" ]]; then chown -R "$app_user:$(id -gn "$app_user")" "$module"; fi
    run_app npm ci --prefix "$module" --omit=dev --no-fund --no-audit
  fi
done
run_app npm ci --omit=dev --no-fund --no-audit
if node --input-type=module -e 'import {getConfig} from "./src/config.js"; process.exit(getConfig().databaseUrl ? 0 : 1)'; then
  run_app npm run migrate
else
  echo 'Starting in temporary memory mode. Add DATABASE_URL when Tiger Data is ready.'
fi
port="$(node --input-type=module -e 'import {getConfig} from "./src/config.js"; console.log(getConfig().port)')"
run_app pm2 startOrRestart deploy/ecosystem.config.cjs --update-env
curl --fail --silent --show-error --retry 10 --retry-delay 1 --retry-connrefused "http://127.0.0.1:${port}/health"
printf '\n'
rendered="$(mktemp)"
trap 'rm -f "$rendered"' EXIT
sed -e "s/MYDOMAIN/${domain}/g" -e "s/3000/${port}/g" deploy/Caddyfile > "$rendered"
admin caddy validate --config "$rendered" --adapter caddyfile
if command -v ufw >/dev/null && admin ufw status | grep -q '^Status: active'; then
  admin ufw allow 80/tcp
  admin ufw allow 443/tcp
fi
if [[ -f ../../web/dist/index.html ]]; then admin chmod -R a+rX ../../web/dist; fi
admin install -m 644 "$rendered" /etc/caddy/Caddyfile
admin systemctl enable --now caddy
admin systemctl reload caddy
run_app pm2 save
if [[ -n "$app_user" ]]; then
  app_home="$(getent passwd "$app_user" | cut -d: -f6)"
  admin env PATH="$PATH" pm2 startup systemd -u "$app_user" --hp "$app_home"
fi
printf 'Backend started. After DNS resolves, check https://%s/health\n' "$domain"
