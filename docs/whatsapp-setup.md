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

cd <path-to-LaporPak>\services\api
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
LAPORPAK_CHANNEL_ACCOUNT_ID=
```

Store them in `%USERPROFILE%\.openclaw\.env`. Never put their real values in
this repository, a prompt, or a screenshot.

Check the installed plugins and configuration:

```powershell
openclaw plugins inspect laporpak-tools --runtime --json
openclaw plugins inspect whatsapp --runtime --json
openclaw config validate
```

The LaporPak plugin must list `laporpak_create_report`, `laporpak_ask`, and
`laporpak_track_report`. The WhatsApp plugin must show `enabled: true`.
`LAPORPAK_CHANNEL_ACCOUNT_ID` must match an active backend
`channel_integrations.external_account_id`; do not ask the model or citizen to
choose this value.

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

The dashboard polls this state after the QR is shown. If OpenClaw reports a
linked account whose runtime has not started yet, FastAPI schedules one guarded
Gateway restart and the next poll confirms the running channel.

The channel uses `dmPolicy: pairing`. When a citizen sends the first message,
approve the access request:

```powershell
openclaw pairing list whatsapp
openclaw pairing approve whatsapp <CODE>
```

The pairing code expires after one hour.

Test the chatbot from a different WhatsApp number than the account scanned by
the QR. The scanned account is the bot identity and cannot start a conversation
with itself.

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

## 6. Run ASK and TRACK tests

After REPORT works, test ASK with an approved synthetic knowledge source and
TRACK with the ticket created by the same WhatsApp sender. The current TRACK
tool accepts `LP-*`; backend support for `REQ-*` is not exposed through the
plugin yet. REQUEST submission is also not an OpenClaw tool at this stage.

## 7. Troubleshooting

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
