# Person A validation and recovery

Updated November 14, 2026 (America/Phoenix).

## Source recovery

The local `server/live` directory contained only dependencies and build archives. Restored its 33 source/configuration/documentation files from `artifacts/pulse-site.tgz`, extracting only the `server/live/` entries. Existing files were checked before extraction; no existing source file was overwritten. The frontend, shared fixtures and shared contract were not restored from the old archive.

Recovery archive SHA-256:

```text
6d1c794933fab45cb35fcc6e7aa5788288e3de95d2334f3c808c527f3d801386
```

Recovered runtime code includes the team-contract integration: WebSocket `{type,data}` envelopes, `lost | slow | fast | got_it` reaction kinds, `{ok:true}` from the end endpoint, and normalization of Person D's fixture event format. The existing report JSON shape is preserved.

## Checks after recovery

- `npm test`: all 17 tests passed on Node v22.20.0.
- Deployment Bash script syntax check: passed.
- `.gitattributes` keeps deployment shell scripts in LF format on Windows checkouts.
- `.env`, installed dependencies, archives and load-test artifacts are excluded from Git.
- This recovery does not redeploy or restart the running backend.

The initial dependency download hit a local certificate-chain error. Installation succeeded with `NODE_USE_SYSTEM_CA=1`, using Windows' trusted certificate store with TLS verification enabled. If it recurs on this Windows machine, set `$env:NODE_USE_SYSTEM_CA = '1'` before `npm ci`.

## Deployment checks already completed

- DNS: `waitwhat.study` points to `155.138.204.14`.
- Public HTTPS `/health`: `{ok:true}`. Checked again during the Person A audit.
- Node backend runs as the `pulse` service account, supervised by PM2; its startup systemd unit is configured. Reboot recovery has not been tested.
- UFW previously allowed only SSH. TCP 80 and 443 were opened for Caddy. Node remains bound to localhost port 3000.
- Public secure WebSocket check: all four student reactions accepted, meter and questions delivered to host, end/report round trip passed.
- Latest deployed frontend: `4b69a97`. `/`, `/host`, `/join`, and `/classes` returned HTTP 200; deployed JavaScript/CSS matched the production build byte-for-byte. The new teacher/student navigation text is present in the deployed bundle.
- Backend and frontend backups are stored on the VM under `/srv/pulse/backups`.

Browser automation was unavailable, so a rendered browser inspection was not completed. Public HTML, assets and application messages were checked directly.

## Earlier five-minute local load test

Command:

```powershell
node scripts/fake-class.js --self-contained --students 60 --seconds 300 --spike 30 --out artifacts/load-test.json
```

| Measurement | Result |
| --- | --- |
| Student sockets | 60, plus one host |
| Measured duration | 300.59 seconds |
| Sent reactions | 3,600 |
| Persisted reactions | 3,600 |
| Dropped reactions | 0 |
| Client send errors | 0 |
| Server protocol/storage errors | 0 |
| Unexpected disconnects | 0 |
| Received host meters | 150 |
| Ping round-trip latency, p95 | 17.77 ms |
| Meter interval, p95 | 2,020.72 ms |

This test ran against local in-memory storage before the transport was aligned with the pulled frontend. The current protocol is covered by the passing 17-test suite and public WebSocket check. The load result does not establish Postgres commit latency or conference Wi-Fi performance. Raw output is in ignored `artifacts/load-test.json`.

## Remaining integration work

- Configure Tiger Data, apply the migration and load the backup session. Database persistence, hypertable creation and continuous-aggregate policy have not been verified against a real database. The deployed backend currently uses memory storage.
- Connect and verify Person B's transcription and AI modules. Transcription remains a frontend stub in this checkout; report generation uses the adapter's backups when B's module is absent.
- Mount Person D's Atlas routes when the team is ready; the current backend does not register them.
- Agree on and implement the proposed pause/resume, class history and activity APIs. The current Classes page has a per-device fallback. Course metadata is not persisted by this backend yet.
- Confidence and quiz-resolution details are stored internally. Extra report fields remain proposed in the frozen team contract.
- Run the full lecture, report, fix and quiz flow with the real database and teammate integrations.
