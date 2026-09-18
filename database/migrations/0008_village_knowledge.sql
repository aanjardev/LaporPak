-- Village Knowledge Personalization System
-- Migration 0008: Village-scoped knowledge management

-- ============================================
-- 1. Village Profiles (structured data)
-- ============================================

CREATE TABLE IF NOT EXISTS village_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    village_id UUID NOT NULL REFERENCES administrative_units(id),

    -- Mandatory fields (Desa Profile)
    village_name TEXT,
    district_name TEXT,
    regency_name TEXT,
    village_chief_name TEXT,
    village_chief_period TEXT,
    village_secretary_name TEXT,

    -- Contact information
    address TEXT,
    phone TEXT,
    email TEXT,
    whatsapp TEXT,

    -- Statistics
    population INTEGER,
    area_km2 NUMERIC(10,2),

    -- Governance structure (JSON for flexibility)
    governance_structure JSONB DEFAULT '{}',

    -- Village logo URL (for display)
    logo_url TEXT,

    -- Metadata
    is_complete BOOLEAN DEFAULT false,
    is_verified BOOLEAN DEFAULT false,
    verified_by UUID REFERENCES admin_accounts(id),
    verified_at TIMESTAMPTZ,

    created_by UUID REFERENCES admin_accounts(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(village_id)
);

COMMENT ON TABLE village_profiles IS 'Structured village profile data for AI context injection';

-- ============================================
-- 2. Extend Knowledge Documents (village scope)
-- ============================================

-- Add village_id to knowledge_documents for multi-village support
ALTER TABLE knowledge_documents
    ADD COLUMN IF NOT EXISTS village_id UUID REFERENCES administrative_units(id);

ALTER TABLE knowledge_documents
    ADD COLUMN IF NOT EXISTS category VARCHAR(100) DEFAULT 'custom';

ALTER TABLE knowledge_documents
    ADD COLUMN IF NOT EXISTS is_mandatory BOOLEAN DEFAULT false;

-- ============================================
-- 3. Extend Knowledge Chunks
-- ============================================

ALTER TABLE knowledge_chunks
    ADD COLUMN IF NOT EXISTS village_id UUID REFERENCES administrative_units(id);

ALTER TABLE knowledge_chunks
    ADD COLUMN IF NOT EXISTS source_reference TEXT;  -- e.g., "Section 3.2", "Page 1"

ALTER TABLE knowledge_chunks
    ADD COLUMN IF NOT EXISTS keywords TEXT[];  -- Extracted keywords for better search

-- ============================================
-- 4. Knowledge Templates (predefined structures)
-- ============================================

CREATE TABLE IF NOT EXISTS knowledge_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100) NOT NULL,  -- 'sop', 'profile', 'governance', 'custom'

    -- Template content (markdown)
    template_content TEXT NOT NULL,

    -- Required fields (JSON schema)
    required_fields JSONB DEFAULT '[]',

    -- Whether this template is required for village setup
    is_required BOOLEAN DEFAULT false,

    -- Order in wizard
    display_order INTEGER DEFAULT 0,

    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE knowledge_templates IS 'Predefined templates for common knowledge documents';

-- ============================================
-- 5. Knowledge Analytics (for improvement)
-- ============================================

CREATE TABLE IF NOT EXISTS knowledge_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chunk_id UUID REFERENCES knowledge_chunks(id) ON DELETE SET NULL,
    document_id UUID REFERENCES knowledge_documents(id) ON DELETE SET NULL,
    village_id UUID REFERENCES administrative_units(id),

    -- Query details
    query_text TEXT NOT NULL,
    retrieved_rank INTEGER,  -- Position in results

    -- Feedback
    was_helpful BOOLEAN,
    citizen_feedback TEXT,

    -- Session info
    session_id TEXT,
    message_id TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE knowledge_analytics IS 'Track knowledge retrieval for continuous improvement';

-- ============================================
-- 6. Indexes
-- ============================================

-- Village profile indexes
CREATE INDEX IF NOT EXISTS idx_village_profiles_village ON village_profiles(village_id);
CREATE INDEX IF NOT EXISTS idx_village_profiles_complete ON village_profiles(is_complete);

-- Knowledge document indexes
CREATE INDEX IF NOT EXISTS idx_knowledge_documents_village ON knowledge_documents(village_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_documents_category ON knowledge_documents(category);
CREATE INDEX IF NOT EXISTS idx_knowledge_documents_active ON knowledge_documents(is_active)
    WHERE is_active = true;

-- Knowledge chunk indexes
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_village ON knowledge_chunks(village_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_document ON knowledge_chunks(document_id);

-- GIN index for FTS on knowledge chunks
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_fts
    ON knowledge_chunks USING gin(to_tsvector('indonesian', content));

-- Analytics indexes
CREATE INDEX IF NOT EXISTS idx_knowledge_analytics_chunk ON knowledge_analytics(chunk_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_analytics_village ON knowledge_analytics(village_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_analytics_helpful ON knowledge_analytics(was_helpful)
    WHERE was_helpful IS NOT NULL;

-- ============================================
-- 7. Seed Data: Knowledge Templates
-- ============================================

INSERT INTO knowledge_templates (name, description, category, template_content, required_fields, is_required, display_order)
VALUES
    -- Village Profile Template
    (
        'Profil Desa',
        'Informasi dasar tentang desa',
        'profile',
        '# Profil Desa

## Identitas Desa
| Field | Value |
|-------|-------|
| Nama Desa | {{village_name}} |
| Kecamatan | {{district_name}} |
| Kabupaten/Kota | {{regency_name}} |

## Pemerintahan Desa
| Jabatan | Nama |
|---------|------|
| Kepala Desa | {{village_chief_name}} |
| Sekretaris Desa | {{village_secretary_name}} |
| Periode Kepemimpinan | {{village_chief_period}} |

## Kontak
- Alamat: {{address}}
- Telepon: {{phone}}
- Email: {{email}}
- WhatsApp: {{whatsapp}}

## Statistik
- Populasi: {{population}} jiwa
- Luas: {{area_km2}} km²
',
        '["village_name", "village_chief_name"]',
        true,
        1
    ),

    -- SOP Surat Keterangan
    (
        'SOP Surat Keterangan',
        'Prosedur layanan surat keterangan',
        'sop',
        '# SOP Surat Keterangan

## Persyaratan
- FC KTP pemohon
- Surat pengantar dari RT/RW
- Dokumen pendukung (sesuai jenis surat)

## Prosedur
1. Pemohon datang ke kantor desa
2. Mengambil nomor antrian
3. Menyerahkan persyaratan ke petugas
4. Petugas memverifikasi dokumen
5. Dokumen diproses
6. Surat ditandatangani oleh Kepala Desa
7. Surat diambil oleh pemohon

## Waktu Pelayanan
- Senin - Jumat: 08.00 - 14.00 WIB
- Sabtu: 08.00 - 12.00 WIB

## Estimasi Waktu
- Surat Sederhana: 1-2 jam
- Surat Kompleks: 1-3 hari kerja

## Biaya
- Gratis (untuk warga)
',
        '["requirements", "procedure"]',
        false,
        2
    ),

    -- SOP Surat Pengantar
    (
        'SOP Surat Pengantar RT/RW',
        'Prosedur surat pengantar dari RT/RW',
        'sop',
        '# SOP Surat Pengantar

## Persyaratan
- KTP asli pemohon
- Keperluan jelas

## Prosedur
1. Warga menemui RT/RW setempat
2. Menjelaskan keperluan
3. RT/RW membuat surat pengantar
4. Ditandatangani oleh RT/RW terkait

## Jenis Surat Pengantar
- Surat pengantar untuk dokumen (KTP, KK, dll)
- Surat pengantar untuk kepentingan sekolah
- Surat pengantar untuk keperluan trabalho
',
        '["requirements", "procedure"]',
        false,
        3
    ),

    -- Struktur Organisasi
    (
        'Struktur Organisasi Desa',
        'Daftar perangkat desa dan RT/RW',
        'governance',
        '# Struktur Organisasi Desa

## Perangkat Desa
| No | Jabatan | Nama |
|----|---------|------|
| 1 | Kepala Desa | {{village_chief_name}} |
| 2 | Sekretaris Desa | {{village_secretary_name}} |
| 3 | Kaur Umum | |
| 4 | Kaur Keuangan | |
| 5 | Kaur Perencanaan | |

## RT/RW
RT dan RW yang ada di desa ini dapat menghubungi kantor desa untuk informasi terbaru.

##联络信息
- Telepon: {{phone}}
- WhatsApp: {{whatsapp}}
- Alamat: {{address}}
',
        '["governance_structure"]',
        false,
        4
    ),

    -- FAQ Umum
    (
        'FAQ Layanan Desa',
        'Pertanyaan yang sering diajukan',
        'custom',
        '# FAQ Layanan Desa

## Jam Operasional
**Kapan kantor desa buka?**
Kantor desa melayani Senin-Jumat pukul 08.00-14.00 WIB, dan Sabtu pukul 08.00-12.00 WIB.

## Layanan Apa Saja?
- Pembuatan Surat Keterangan
- Surat Pengantar RT/RW
- Pembuatan Kartu Keluarga (KK)
- Pembuatan KTP (dilayani di kecamatan)
- Informasi layanan masyarakat

## Berapa Biaya?
Seluruh layanan di kantor desa **GRATIS** untuk warga. Jangan ragu untuk melapor jika ada yang meminta bayaran.

## Bagaimana Cara Melapor?
Anda bisa melapor melalui:
1. WhatsApp ke nomor resmi desa
2. Datang langsung ke kantor desa
3. Melalui RT/RW setempat
',
        '[]',
        false,
        5
    )
ON CONFLICT DO NOTHING;

-- ============================================
-- 8. Trigger: Auto-update updated_at
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_village_profiles_updated
    BEFORE UPDATE ON village_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_knowledge_documents_updated
    BEFORE UPDATE ON knowledge_documents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_knowledge_templates_updated
    BEFORE UPDATE ON knowledge_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- 9. Update existing chunks with village_id from documents
-- ============================================

-- Update knowledge_chunks to have village_id from documents
UPDATE knowledge_chunks kc
SET village_id = kd.village_id
FROM knowledge_documents kd
WHERE kc.document_id = kd.id AND kc.village_id IS NULL AND kd.village_id IS NOT NULL;

-- ============================================
-- 10. Comments for documentation
-- ============================================

COMMENT ON COLUMN knowledge_documents.village_id IS
    'Village that owns this knowledge document. NULL means shared across all villages.';

COMMENT ON COLUMN knowledge_documents.category IS
    'Category: village_profile, sop, governance, custom';

COMMENT ON COLUMN knowledge_chunks.village_id IS
    'Village scope for this chunk. NULL inherits from document.';

COMMENT ON COLUMN knowledge_chunks.source_reference IS
    'Reference to source location, e.g., "Page 1", "Section 3.2"';

COMMENT ON COLUMN knowledge_chunks.keywords IS
    'Extracted keywords for better search matching';
