import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
const domain = process.argv[2] || 'transcribe.waitwhat.study';
if (!/^[a-z\d.-]+\.[a-z]{2,}$/i.test(domain)) throw new Error('Supply a hostname, without a protocol or path');
await mkdir(new URL('../.generated/', import.meta.url), { recursive: true });
let token;
try { token = (await readFile(new URL('../.generated/token', import.meta.url), 'utf8')).trim(); }
catch { token = randomBytes(32).toString('hex'); await writeFile(new URL('../.generated/token', import.meta.url), token, { mode: 0o600 }); }
const app = await readFile(new URL('../worker/app.py', import.meta.url), 'utf8');
const requirements = await readFile(new URL('../worker/requirements.txt', import.meta.url), 'utf8');
const unit = `[Unit]\nDescription=Waitwhat speech worker\nAfter=network-online.target\nWants=network-online.target\n[Service]\nUser=whisper\nEnvironmentFile=/etc/whisper.env\nEnvironment=HF_HOME=/opt/whisper/models\nExecStart=/opt/whisper/venv/bin/python /opt/whisper/app.py\nRestart=on-failure\nRestartSec=5\nWorkingDirectory=/opt/whisper\nNoNewPrivileges=true\nPrivateTmp=true\nProtectHome=true\nProtectSystem=strict\nReadWritePaths=/opt/whisper/models\n[Install]\nWantedBy=multi-user.target\n`;
const caddy = `${domain} {\n    @backend remote_ip 155.138.204.14/32\n    handle @backend {\n        reverse_proxy 127.0.0.1:8000\n    }\n    respond 403\n}\n`;
const files = [
  ['/opt/whisper/app.py', app, '0644'], ['/opt/whisper/requirements.txt', requirements, '0644'],
  ['/etc/whisper.env', `WHISPER_TOKEN=${token}\nWHISPER_MODEL=tiny.en\n`, '0600'],
  ['/etc/systemd/system/whisper.service', unit, '0644'], ['/etc/caddy/Caddyfile', caddy, '0644'],
];
let yaml = '#cloud-config\npackage_update: true\npackages: [python3-venv, caddy]\nwrite_files:\n';
for (const [path, content, permissions] of files) yaml += `  - path: ${path}\n    permissions: '${permissions}'\n    content: |\n${content.split('\n').map(line => '      ' + line).join('\n')}\n`;
yaml += `runcmd:\n  - useradd --system --home-dir /opt/whisper --shell /usr/sbin/nologin whisper\n  - python3 -m venv /opt/whisper/venv\n  - /opt/whisper/venv/bin/pip install --no-cache-dir -r /opt/whisper/requirements.txt\n  - mkdir -p /opt/whisper/models\n  - chown -R whisper:whisper /opt/whisper/models\n  - systemctl daemon-reload\n  - systemctl enable --now whisper\n  - caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile\n  - systemctl enable caddy\n  - systemctl restart caddy\n`;
await writeFile(new URL('../.generated/cloud-init.yaml', import.meta.url), yaml, { mode: 0o600 });
await writeFile(new URL('../.generated/worker.env', import.meta.url), `TRANSCRIPTION_PROVIDER=whisper\nWHISPER_URL=https://${domain}\nWHISPER_TOKEN=${token}\nTRANSCRIBE_ENABLED=false\n`, { mode: 0o600 });
console.log('Prepared private cloud-init.yaml and worker.env under server/transcribe/.generated/. No AWS resources were created.');
