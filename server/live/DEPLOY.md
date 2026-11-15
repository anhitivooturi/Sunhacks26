# Person A: from no accounts to a public health endpoint

First run the local commands in [README.md](README.md). Person A deploys the backend and compiled frontend; teammates own the web source, AWS Transcribe, Gemini and MongoDB integrations. Provider screens and available plans can vary. Check the displayed charge before purchasing anything.

## Current server: quick upload from the existing root session

The current public site is `https://waitwhat.study`; the deployed frontend is commit `4b69a97`. Caddy serves the React build from `/srv/pulse/web/dist` and proxies REST/WebSockets to `127.0.0.1:3000`.

To prepare a full release from the repository root in PowerShell:

```powershell
$env:VITE_USE_MOCK = 'false'
npm --prefix web ci
npm --prefix web run build
New-Item -ItemType Directory -Force server/live/artifacts | Out-Null
tar -czf server/live/artifacts/pulse-site.tgz --exclude=node_modules --exclude=.env --exclude=.env.local --exclude=.certs --exclude=artifacts --exclude=*.log server/live web/dist fixtures docs/contract.md
scp server/live/artifacts/pulse-site.tgz root@155.138.204.14:/tmp/pulse-site.tgz
```

In the VM's root SSH session:

```bash
tar -xzf /tmp/pulse-site.tgz -C /srv/pulse
cd /srv/pulse/server/live
bash deploy/deploy.sh waitwhat.study
```

The deploy script preserves `.env`, runs Node under the `pulse` service account, and opens HTTP/HTTPS ports if UFW is active. Verify `https://waitwhat.study/health` and `/host` afterward. A full backend restart clears memory-mode sessions. For frontend-only changes, copy hashed assets first and replace `web/dist/index.html` last; this does not require restarting the backend. Old releases are backed up under `/srv/pulse/backups` on the VM.

The following backend-only archive workflow remains available for backend-only updates.

The current VM is `155.138.204.14`, and Porkbun DNS points `waitwhat.study` to it. Once Node 22, PM2 and Caddy are installed, upload A's archive from Windows PowerShell:

```powershell
cd C:\Users\Ani\Documents\GitHub\Sunhacks26
scp server/live/artifacts/pulse-live.tgz root@155.138.204.14:/tmp/pulse-live.tgz
```

Then, in the existing `root@waitwhat` SSH terminal:

```bash
mkdir -p /srv/pulse/server
tar -xzf /tmp/pulse-live.tgz -C /srv/pulse/server
cd /srv/pulse/server/live
bash deploy/deploy.sh waitwhat.study
```

When run as root, the deploy script creates a `pulse` service user if needed, gives it ownership of this backend directory, runs npm/PM2 under that user, and configures its PM2 systemd startup service. Caddy setup runs with root privileges. No separate service-user password is needed. On future root sessions, inspect logs with `runuser -u pulse -- pm2 logs pulse-live --lines 50`.

Verify `https://waitwhat.study/health`. This initial deployment uses memory storage until `DATABASE_URL` is configured. The archive excludes `.env`, node_modules and artifacts; rebuild it after changing backend files. The remaining sections describe account setup and the alternative interactive `pulse` login flow.

## 1. Create a Vultr VM

Create/sign in to [Vultr](https://my.vultr.com/), then deploy a Cloud Compute server with Ubuntu 24.04 LTS. Choose a nearby region and a small shared-CPU plan; review its displayed price and billing terms. Add your SSH public key during creation. One Node process plus Caddy is the initial workload; Tiger Data hosts the database separately.

If you need an SSH key, run this in Windows PowerShell, accept the default file path, and set a passphrase:

```powershell
ssh-keygen -t ed25519 -C "pulse-hackathon"
Get-Content $env:USERPROFILE/.ssh/id_ed25519.pub
```

Paste only the `.pub` contents into Vultr. Save the server's public IPv4 address after provisioning. In a Vultr firewall group attached to this instance, permit TCP 22 from your IP, TCP 80 from anywhere, and TCP 443 from anywhere. If you publish IPv6 DNS, configure its firewall too. Do not expose port 3000; Caddy talks to Node on localhost.

From your own PowerShell terminal, connect using the IP Vultr gives you:

```powershell
ssh root@YOUR_VM_IP
```

Follow [Vultr's SSH instructions](https://docs.vultr.com/products/compute/instances/cloud-compute/connection/openssh) if the connection fails. Verify the SSH host fingerprint against the VM information/console before accepting the new host key.

## 2. Prepare the VM

Run these in the Ubuntu SSH terminal as root. `adduser` asks you to choose a password for the new deployment user:

```bash
apt-get update
apt-get install -y ca-certificates curl gnupg caddy
install -d -m 755 /etc/apt/keyrings
curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key -o /tmp/nodesource.key
gpg --dearmor --yes --output /etc/apt/keyrings/nodesource.gpg /tmp/nodesource.key
echo 'deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_22.x nodistro main' > /etc/apt/sources.list.d/nodesource.list
apt-get update
apt-get install -y nodejs
npm install --global pm2
node --version
adduser pulse
usermod -aG sudo pulse
install -d -m 700 -o pulse -g pulse /home/pulse/.ssh
install -m 600 -o pulse -g pulse /root/.ssh/authorized_keys /home/pulse/.ssh/authorized_keys
install -d -o pulse -g pulse /srv/pulse/server
```

This installs Node 22 using NodeSource's signed package repository. See the [NodeSource installation repository](https://github.com/nodesource/distributions) for supported OS details. The `authorized_keys` command assumes you attached your key when creating the VM. If not, add your public key to the new user's file using the console. Keep the original root SSH window open until `ssh pulse@YOUR_VM_IP` works in another terminal.

## 3. Get a domain and point it at the VM

At [GoDaddy](https://www.godaddy.com/), register an available domain or use a domain you already own. Review the renewal price too. In that domain's DNS management, add an A record:

| Field | Value |
| --- | --- |
| Type | A |
| Name | `@` for the root domain, or `pulse` for `pulse.yourdomain.com` |
| Value | your Vultr public IPv4 |
| TTL | default |

Replace an existing conflicting A record for the same name. Only add AAAA if IPv6 is actually configured on the VM. If the domain uses other nameservers, edit DNS at that provider. Use GoDaddy's [A-record guide](https://www.godaddy.com/help/add-an-a-record-19238) for the current screen names.

In PowerShell, check that your chosen name resolves to the VM:

```powershell
Resolve-DnsName pulse.yourdomain.com -Type A
```

The rest of this guide uses `pulse.yourdomain.com`; substitute the exact name you chose, including the subdomain if any.

## 4. Upload only A's backend

From Windows PowerShell at the repository root (this archive excludes credentials and installed dependencies):

```powershell
tar -czf pulse-live.tgz --exclude=node_modules --exclude=.env --exclude=.certs --exclude=artifacts -C server live
scp pulse-live.tgz pulse@YOUR_VM_IP:/tmp/pulse-live.tgz
ssh pulse@YOUR_VM_IP
```

In the new Ubuntu SSH terminal as `pulse`:

```bash
tar -xzf /tmp/pulse-live.tgz -C /srv/pulse/server
cd /srv/pulse/server/live
cp .env.example .env
chmod 600 .env
bash deploy/deploy.sh pulse.yourdomain.com
```

The script uses memory mode initially, installs locked Node dependencies, starts one PM2 process, verifies the local health endpoint, renders and validates Caddy's config, and reloads Caddy. It asks for your `pulse` user's sudo password when installing the Caddy configuration. It manages `/etc/caddy/Caddyfile` on this new VM; preserve any preexisting sites before reusing it on a shared VM.

Caddy obtains/renews certificates automatically when the domain resolves correctly and ports 80/443 are reachable. WebSocket upgrades are supported by its reverse proxy without extra headers. See [Caddy automatic HTTPS](https://caddyserver.com/docs/automatic-https) and [reverse proxy documentation](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy).

From Windows:

```powershell
Invoke-RestMethod https://pulse.yourdomain.com/health
```

Expected: `ok` is `True`. Caddy proxies the backend routes and serves the built frontend from `/srv/pulse/web/dist`; `/j/CODE` opens the student screen when that build is installed.

## 5. Keep PM2 running across reboots

Run as `pulse` on the VM:

```bash
pm2 startup
```

PM2 prints a `sudo ... pm2 startup ...` command containing your user's exact PATH. Run that printed command, then:

```bash
pm2 save
pm2 status
```

For troubleshooting:

```bash
pm2 logs pulse-live --lines 50
sudo journalctl -u caddy -n 50 --no-pager
curl http://127.0.0.1:3000/health
```

If local health works but HTTPS does not, check DNS, firewall attachment/rules, Caddy logs, and whether an old AAAA record points elsewhere. `pm2 restart pulse-live` briefly disconnects sockets; student clients should reconnect with the same ID.

## 6. Add Tiger Data persistence

Create/sign in to [Tiger Data](https://console.cloud.timescale.com/) and create a Postgres/Timescale service. Review the displayed trial, plan and region; select a region near the VM. Save its generated database password privately. Use the service's connection details/connection string from the console; do not invent the host, port or username. See [Create a service](https://www.tigerdata.com/docs/get-started/quickstart/create-service) and [connection details](https://www.tigerdata.com/docs/integrate/find-connection-details).

On the VM:

```bash
cd /srv/pulse/server/live
nano .env
```

Set `DATABASE_URL` to the provider's URL (including its SSL settings). Keep `BASE_URL=https://pulse.yourdomain.com`, `HOST=127.0.0.1`, and `PORT=3000`. Never commit `.env` or paste its contents into chat. TLS certificate validation remains enabled. If the service uses an IP allowlist, permit the VM's outbound public IP; permit your home IP too only if running migrations locally.

Then:

```bash
npm run migrate
npm run seed
pm2 restart pulse-live
curl https://pulse.yourdomain.com/health
```

Create a new session through the REST API, note its ID, restart PM2, and fetch that session's report/transcript to confirm persistence. Sessions created in earlier memory mode do not migrate into the database. Keep the `DEMX` seeded report as a separate backup session.

## 7. Redeploy later

Repeat the archive/upload/extract step for A's changed files, **skip `cp .env.example .env`** to preserve credentials, and run:

```bash
cd /srv/pulse/server/live
bash deploy/deploy.sh pulse.yourdomain.com
```

Use a single PM2 worker for this version. AWS Transcribe, Gemini, Atlas and web assets are separate teammate integrations; do not buy or configure those on their behalf without coordinating.
