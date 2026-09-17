# LaporPak Tools

OpenClaw plugin for the single `laporpak_create_report` operation. It accepts
only confirmed REPORT facts, gets the citizen identity from authenticated
WhatsApp runtime metadata, and calls the FastAPI boundary with a stable
idempotency key.

Runtime values come from the OpenClaw host environment:

```env
LAPORPAK_API_URL=http://localhost:8000
LAPORPAK_API_KEY=
```

The plugin does not read Supabase or Gemini credentials and never accepts an
API URL, API key, or citizen phone number from model-generated tool input.

Run its dependency-free tests with:

```powershell
npm test
```
