# Plan: Multi-Desa (Multi-Village) Support

## Executive Summary

Sistem LaporPak sudah memiliki fondasi multi-desa yang kuat. Infrastruktur database sudah mendukung multi-tenancy melalui `administrative_unit_id`. Yang perlu dilakukan adalah:
1. Membangun flow registrasi desa
2. Kustomisasi AI personality per desa
3. Koneksi WhatsApp per desa
4. UI dashboard untuk pengelolaan per desa

---

## Analisis Kodebase Saat Ini

### Yang Sudah Ada ✅

| Komponen | Status | Detail |
|----------|--------|--------|
| `administrative_units` | ✅ | Tabel desa dengan `level`, `parent_id`, `metadata` JSONB |
| `admin_accounts` | ✅ | Akun admin dengan role (`SYSTEM_ADMIN`, `VILLAGE_ADMIN`) |
| `admin_unit_memberships` | ✅ | Many-to-many mapping admin ke desa |
| `channel_integrations` | ✅ | Mapping WhatsApp → village via `external_account_id` |
| `knowledge_documents` | ✅ | Scoped per `administrative_unit_id` |
| Auth via Supabase | ✅ | JWT Bearer tokens, sudah ada role-based access |
| OpenClaw Plugin | ✅ | Tools sudah menggunakan `X-Channel-Account-ID` untuk routing |

### Yang Perlu Dibuat/Ingin Ditambahkan 🔧

| Komponen | Priority | Detail |
|----------|----------|--------|
| Village Registration Flow | **HIGH** | API + UI untuk menambah desa baru |
| Village Admin Creation | **HIGH** | Mekanisme invite admin baru per desa |
| Per-Village AI Personality | **HIGH** | Kustomisasi IDENTITY.md, SOUL.md per desa |
| Village Settings UI | **MEDIUM** | Custom branding, categories per village |
| Village Selector UI | **MEDIUM** | Dropdown switch antar desa di dashboard |
| OpenClaw Workspace Management | **HIGH** | Generate & manage OpenClaw config per village |

---

## Arsitektur Multi-Desa

### High-Level Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                          SUPER ADMIN                                 │
│  - Manage all villages                                               │
│  - Create new village                                                │
│  - Assign village admins                                             │
└───────────────────────┬─────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      VILLAGE ADMIN                                  │
│  - Login (Verifikasi desa via Supabase Auth)                        │
│  - Customize AI personality (IDENTITY/SOUL)                         │
│  - Manage knowledge base                                            │
│  - View reports & requests                                           │
│  - Setup WhatsApp QR Code                                           │
└───────────────────────┬─────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    PER-VILLAGE ASSETS                               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                 │
│  │ WhatsApp    │  │ OpenClaw    │  │ Knowledge   │                 │
│  │ Bot         │  │ Workspace   │  │ Base       │                 │
│  │ (unique #)  │  │ (AI brain)  │  │ (docs)     │                 │
│  └─────────────┘  └─────────────┘  └─────────────┘                 │
└─────────────────────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     CITIZEN (WhatsApp)                               │
│  - Chat with village-specific AI                                     │
│  - Submit reports                                                   │
│  - Ask questions                                                     │
│  - Track requests                                                    │
└─────────────────────────────────────────────────────────────────────┘
```

### Database Schema (Already Supported)

```sql
-- Village/Desa
administrative_units (level='village')

-- Admin per Village
admin_accounts (role='village_admin')
admin_unit_memberships (links admin → village)

-- WhatsApp per Village
channel_integrations (channel='whatsapp', external_account_id=phone_number)

-- Content per Village
knowledge_documents (administrative_unit_id)
reports (administrative_unit_id)
service_requests (administrative_unit_id)
```

### AI Multi-Tenancy Strategy

**Single Model, Multi-Context Approach:**

1. **Per-Village OpenClaw Workspace**
   - Setiap desa punya folder workspace sendiri: `openclaw/workspaces/{village_id}/`
   - Folder berisi: `IDENTITY.md`, `SOUL.md`, `memory/`
   - OpenClaw di-config dengan workspace path per-desa

2. **Database-Driven Configuration**
   - Village settings di `administrative_units.metadata` JSONB:
     ```json
     {
       "ai_name": "Kang Asep",
       "ai_emoji": "🤖",
       "ai_vibe": "Santai dan familiar seperti tetangga",
       "welcome_message": "Selamat datang di Desa Siaga!",
       "categories": ["infrastructure", "public_facility", ...],
       "custom_greetings": ["Halo", "Hai", "Assalamualaikum"]
     }
     ```

3. **System Prompt Construction**
   - Base prompt + village-specific metadata
   - Runtime injection via OpenClaw tools

---

## Implementation Phases

### Phase 1: Core Infrastructure (Foundation)

**Goal**: Membangun fondasi multi-desa yang solid

#### 1.1 Village Registration API

**File**: `services/api/app/api/routes/villages.py` (NEW)

```python
# Endpoints:
POST   /api/v1/villages                    # Create village (super_admin only)
GET    /api/v1/villages                   # List all villages
GET    /api/v1/villages/{id}             # Get village details
PATCH  /api/v1/villages/{id}              # Update village settings
DELETE /api/v1/villages/{id}              # Deactivate village
```

**Request Body**:
```json
{
  "name": "Desa Sukamaju",
  "level": "village",
  "parent_id": "<district_uuid>",  // optional
  "metadata": {
    "ai_name": "Kang Asep",
    "ai_emoji": "🤖",
    "welcome_message": "Selamat datang di Desa Sukamaju!"
  }
}
```

#### 1.2 Village Admin Invitation

**File**: `services/api/app/api/routes/admin_invitations.py` (NEW)

```python
# Endpoints:
POST   /api/v1/admin-invitations          # Create invitation (super_admin or self)
GET    /api/v1/admin-invitations          # List invitations
DELETE /api/v1/admin-invitations/{id}     # Revoke invitation
```

**Invitation Flow**:
1. Super Admin creates invitation for email + village
2. System sends invite link with token
3. User clicks link → sets password → becomes village admin

#### 1.3 Database Migration

**File**: `services/api/app/db/migrations/add_village_fields.py` (NEW)

Add to `administrative_units`:
- `ai_personality` JSONB column for AI config
- `is_ai_enabled` boolean
- `custom_categories` JSONB

---

### Phase 2: Frontend Dashboard (Admin UI)

**Goal**: UI untuk mengelola multi-desa

#### 2.1 Village Management Page

**File**: `apps/dashboard/app/admin/villages/page.tsx` (NEW)

Features:
- List all villages (super admin only)
- Create new village modal
- Edit village settings
- View village statistics

#### 2.2 Village Selector

**File**: `apps/dashboard/components/village-selector.tsx` (NEW)

Features:
- Dropdown in navbar to switch between villages
- Shows current village name + emoji
- Only visible to admins with multiple village access

#### 2.3 Village Settings Page

**File**: `apps/dashboard/app/admin/villages/[id]/settings/page.tsx` (NEW)

Features:
- AI Personality customization (name, emoji, vibe)
- Welcome message customization
- Category management
- WhatsApp integration status

#### 2.4 Village AI Customization

**File**: `apps/dashboard/app/admin/villages/[id]/ai-customization/page.tsx` (NEW)

Features:
- Edit IDENTITY.md content via form
- Edit SOUL.md content via form
- Preview AI behavior
- Save → updates OpenClaw workspace

---

### Phase 3: OpenClaw Integration (AI Brain)

**Goal**: Koneksi OpenClaw per-desa

#### 3.1 OpenClaw Workspace Generator

**File**: `services/api/app/services/openclaw_workspace.py` (NEW)

```python
def create_village_workspace(village_id: UUID) -> str:
    """Create OpenClaw workspace for a village"""
    workspace_path = f"openclaw/workspaces/{village_id}/"
    # Create IDENTITY.md
    # Create SOUL.md
    # Create workspace.json
    return workspace_path

def update_village_workspace(village_id: UUID, config: VillageAIConfig):
    """Update village AI configuration"""
    ...

def get_village_openclaw_config(village_id: UUID) -> dict:
    """Generate OpenClaw config for village"""
    return {
        "workspace": f"openclaw/workspaces/{village_id}/",
        "api_url": settings.openclaw_api_url,
        "api_key": settings.openclaw_api_key,
    }
```

#### 3.2 OpenClaw Service Registry

**File**: `services/api/app/services/channel_registry.py` (NEW)

Manages WhatsApp → OpenClaw → Village mapping:
```python
class ChannelRegistry:
    def get_openclaw_config_for_channel(self, channel_account_id: str) -> dict:
        """Get OpenClaw config based on WhatsApp channel"""

    def register_channel(self, village_id: UUID, channel_type: str, external_id: str):
        """Register new WhatsApp channel for village"""
```

#### 3.3 WhatsApp QR Code Integration

**File**: `services/api/app/api/routes/whatsapp_setup.py` (NEW)

```python
# Endpoints:
POST   /api/v1/villages/{id}/whatsapp/init     # Get QR code URL
GET    /api/v1/villages/{id}/whatsapp/status    # Check connection status
DELETE /api/v1/villages/{id}/whatsapp/disconnect
```

---

### Phase 4: Testing & Polish

**Goal**: Ensure everything works together

#### 4.1 Integration Testing
- Test village creation flow
- Test admin invitation flow
- Test WhatsApp connection per village
- Test AI personalization

#### 4.2 UI Polish
- Loading states
- Error handling
- Empty states
- Mobile responsiveness

---

## Design Decisions

### Q: Apakah skema multi-desa ini sudah tepat?

**Ya, arsitekturnya sudah solid.** Fondasi database sudah benar dengan `administrative_unit_id` sebagai tenant identifier. Yang missing adalah:

1. **Registration flow** - belum ada UI untuk menambah desa
2. **AI personalization** - belum ada mekanisme untuk customize AI per desa
3. **OpenClaw isolation** - belum ada workspace management per desa

### Q: Apakah satu model AI cukup untuk banyak desa?

**Ya, cukup.** Approach yang dipilih:

1. **Single OpenAI/Anthropic API key** - cost efficient
2. **Per-village context injection** - village metadata disisipkan di prompt
3. **Per-village OpenClaw workspace** - memory & personality terisolate
4. **Database-level filtering** - knowledge base per-desa

Ini lebih cost-effective daripada fine-tuning per-desa, dan performanya cukup untuk use case ini.

### Q: Skema multi-desa yang terbaik?

**Recommended Architecture:**

```
┌─────────────────────────────────────────────────────────────┐
│                    LAPORPAK BACKEND                          │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐         │
│  │ Village A   │ │ Village B   │ │ Village C   │         │
│  │ API Context │ │ API Context │ │ API Context │         │
│  └─────────────┘ └─────────────┘ └─────────────┘         │
│         │               │               │                   │
│         └───────────────┴───────────────┘                   │
│                         │                                    │
│                    Shared AI Model                           │
│                   (OpenAI/Anthropic)                         │
└─────────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                    OPENCLAW LAYER                            │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐         │
│  │ Workspace A │ │ Workspace B │ │ Workspace C │         │
│  │ (memory,    │ │ (memory,    │ │ (memory,    │         │
│  │  identity)  │ │  identity)  │ │  identity)  │         │
│  └─────────────┘ └─────────────┘ └─────────────┘         │
└─────────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                   WHATSAPP CHANNELS                          │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐         │
│  │ WA Number A │ │ WA Number B │ │ WA Number C │         │
│  └─────────────┘ └─────────────┘ └─────────────┘         │
└─────────────────────────────────────────────────────────────┘
```

---

## Files to Create/Modify

### New Files

```
services/api/app/
├── api/routes/
│   ├── villages.py              # Village CRUD
│   ├── admin_invitations.py     # Admin invite flow
│   ├── village_settings.py      # Village config
│   └── whatsapp_setup.py        # WhatsApp QR code
├── services/
│   ├── openclaw_workspace.py    # OpenClaw workspace mgmt
│   └── channel_registry.py      # Channel → Village mapping
└── schemas/
    └── village.py               # Pydantic schemas

apps/dashboard/
├── app/
│   ├── admin/
│   │   └── villages/
│   │       ├── page.tsx         # Village list
│   │       └── [id]/
│   │           ├── page.tsx      # Village detail
│   │           ├── settings/
│   │           │   └── page.tsx
│   │           └── ai/
│   │               └── page.tsx
│   └── api/
│       └── villages/
│           └── route.ts
├── components/
│   ├── village-selector.tsx     # Village switcher
│   └── village-card.tsx
└── lib/
    └── village-api.ts           # Village API client
```

### Modified Files

```
services/api/app/
├── db/tables.py                 # Add village fields
├── main.py                      # Add village routes
├── core/security.py             # Add village validation
└── api/routes/reports.py        # Already supports unit_ids

apps/dashboard/
├── app/login/page.tsx           # Add village selector on login
├── components/layout/
│   └── navbar.tsx               # Add village selector
└── lib/auth.ts                  # Add village context
```

---

## Migration Plan

### Before Starting

1. [ ] Backup database
2. [ ] Document current admin accounts
3. [ ] Note current OpenClaw config

### Step 1: Database Migration
```bash
# Add new columns to administrative_units
ALTER TABLE administrative_units ADD COLUMN ai_personality JSONB DEFAULT '{}';
ALTER TABLE administrative_units ADD COLUMN is_ai_enabled BOOLEAN DEFAULT true;
```

### Step 2: Seed Existing Data
```python
# Update existing village with default AI personality
UPDATE administrative_units
SET ai_personality = '{"name": "LaporPak", "emoji": "📋", "vibe": "Tegas dan membantu"}'
WHERE level = 'village' AND is_active = true;
```

### Step 3: Deploy Backend Changes
- Deploy villages API
- Deploy OpenClaw workspace service
- Test authentication flow

### Step 4: Deploy Frontend Changes
- Deploy village management UI
- Deploy village selector
- Test end-to-end flow

### Step 5: Onboarding First New Village
1. Create village via admin UI
2. Assign village admin
3. Admin logs in → customizes AI
4. Admin scans WhatsApp QR
5. Test citizen interaction

---

## Success Metrics

1. **Functional**
   - [ ] Super admin can create new village
   - [ ] Village admin can customize AI personality
   - [ ] WhatsApp connects per village
   - [ ] Reports/requests isolated per village
   - [ ] Knowledge base scoped per village

2. **Performance**
   - [ ] AI response time < 5s per village
   - [ ] Dashboard loads < 2s
   - [ ] WhatsApp message delivery < 3s

3. **Security**
   - [ ] Village admin cannot see other village's data
   - [ ] Super admin can audit all villages
   - [ ] WhatsApp webhook secured per channel

---

## Questions for Discussion

1. **Deployment Model**: Should each village run its own OpenClaw instance, or use one shared OpenClaw with workspace isolation?

2. **Initial Village Setup**: Should the first village (demo) be pre-configured, or should super admin create it during setup?

3. **WhatsApp Number**: Will villages use their own WhatsApp Business numbers, or will you provide a shared pool?

4. **AI Model Choice**: Continue with Gemini (current), or consider switching to GPT-4 for better multi-turn conversation?

---

## Next Steps After Approval

1. **Implement Phase 1** (Core Infrastructure)
   - Village Registration API
   - Admin Invitation Flow
   - Database Migration

2. **Implement Phase 2** (Frontend Dashboard)
   - Village Management UI
   - Village Selector
   - Settings Pages

3. **Implement Phase 3** (OpenClaw Integration)
   - Workspace Generator
   - AI Customization
   - WhatsApp Setup

4. **Testing & Documentation**
   - Integration tests
   - User documentation
   - Admin guide
