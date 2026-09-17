# WhatsApp Setup for LaporPak

LaporPak's current development channel uses the official OpenClaw WhatsApp
plugin. It links a WhatsApp account through a QR code and does not require a
Meta Cloud API access token, phone number ID, or public webhook.

Use a dedicated WhatsApp number when possible. Keep the backend and OpenClaw
on the same Windows host during local development.

## 1. Verify the local services

Open PowerShell and verify Node.js, OpenClaw, and FastAPI:

```powershell
node --version
openclaw --version

cd D:\Dev\LaporPak\services\api
uv sync
uv run uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Keep that terminal open. In a second PowerShell window, verify the API:

```powershell
Invoke-RestMethod http://127.0.0.1:8000/health
```

The response must contain `status: ok`.

## 2. Verify the OpenClaw configuration

The local OpenClaw environment must contain these values:

```env
GEMINI_API_KEY=
LAPORPAK_API_URL=http://localhost:8000
LAPORPAK_API_KEY=
```

Store them in `%USERPROFILE%\.openclaw\.env`. Never put their real values in
this repository, a prompt, or a screenshot.

Check the installed plugins and configuration:

```powershell
openclaw plugins inspect laporpak-tools --runtime --json
openclaw plugins inspect whatsapp --runtime --json
openclaw config validate
```

The LaporPak plugin must list `laporpak_create_report`. The WhatsApp plugin
must show `enabled: true`.

## 3. Link the WhatsApp account

Run:

```powershell
openclaw channels login --channel whatsapp
```

On the phone that owns the WhatsApp number:

1. Open WhatsApp.
2. Open **Settings** or the three-dot menu.
3. Select **Linked devices**.
4. Select **Link a device**.
5. Scan the QR code shown by OpenClaw.

The QR expires, so scan it directly from the active terminal. Do not share the
QR with another person.

## 4. Start and verify the Gateway

The Gateway is installed as the Windows Scheduled Task `OpenClaw Gateway`.
Start and inspect it with:

```powershell
openclaw gateway start
openclaw gateway health
openclaw channels status --probe
```

The expected WhatsApp state after QR pairing is `enabled`, `configured`,
`linked`, and `running`.

The channel uses `dmPolicy: pairing`. When a citizen sends the first message,
approve the access request:

```powershell
openclaw pairing list whatsapp
openclaw pairing approve whatsapp <CODE>
```

The pairing code expires after one hour.

## 5. Run the REPORT test

Send this message from an approved WhatsApp number:

```text
Pak, jalan di RT 03 dekat masjid rusak parah.
```

Expected flow:

1. OpenClaw asks Gemini to classify and extract the REPORT.
2. OpenClaw asks for missing information when needed.
3. OpenClaw summarizes the report and asks for confirmation.
4. Reply `Ya`.
5. `laporpak_create_report` calls FastAPI.
6. FastAPI persists the report and initial history in Supabase.
7. The citizen receives the database-issued ticket number and
   `pending_verification` status.

Confirm that only one report exists even if `Ya` is sent twice. The same report
draft UUID must be reused for retries.

## 6. Troubleshooting

If OpenClaw says WhatsApp is not linked:

```powershell
openclaw channels login --channel whatsapp
openclaw channels status --probe
```

If the Gateway is unreachable:

```powershell
openclaw gateway start
openclaw gateway status
openclaw logs
```

If report creation fails, verify both services first:

```powershell
Invoke-RestMethod http://127.0.0.1:8000/health
openclaw gateway health
```

Do not claim a ticket was created until FastAPI returns a persisted ticket
number.
