from io import BytesIO
from uuid import uuid4

from PIL import Image as PillowImage
from pypdf import PdfReader

from app.services import openclaw_gateway as gateway_module
from app.services.openclaw_gateway import (
    OpenClawGateway,
    OpenClawGatewayTimeoutError,
)
from app.services.report_documents import (
    missing_letterhead_fields,
    render_report_pdf,
    validate_logo,
)


def png_bytes(color: str = "#f5c400") -> bytes:
    output = BytesIO()
    PillowImage.new("RGB", (640, 480), color).save(output, format="PNG")
    return output.getvalue()


def snapshot() -> dict:
    return {
        "document_id": str(uuid4()),
        "version": 1,
        "title": "Bukti Penerimaan Laporan",
        "ticket_number": "LP-2026-0042",
        "description": ("Jalan rusak & licin <dekat pasar>. " * 90).strip(),
        "location": "RT 03 & RW 02",
        "status_label": "Diterima - menunggu verifikasi",
        "created_at": "2026-09-20T08:00:00+07:00",
        "verified_at": None,
        "verified_by": None,
        "issued_at": "2026-09-20T08:05:00+07:00",
        "citizen_name": "Warga <Contoh>",
        "citizen_phone_masked": "+6287******471",
        "category": "Infrastruktur",
        "attachment_count": 2,
        "village": {
            "name": "Sukamaju",
            "regency_type": "Kabupaten",
            "regency": "Malang",
            "district": "Pakis",
            "address": "Jl. Merdeka No. 1",
            "postal_code": "65154",
            "document_official_name": "Budi Santoso",
            "document_official_title": "Kepala Desa",
        },
    }


def test_renderer_handles_long_text_and_multiple_photo_pages():
    pdf = render_report_pdf(
        snapshot(),
        f"https://laporpak.example/verify/{uuid4()}",
        logo=png_bytes(),
        attachment_images=[
            ("foto & satu.png", png_bytes()),
            ("foto-dua.png", png_bytes("#17325c")),
        ],
    )

    reader = PdfReader(BytesIO(pdf))
    text = "\n".join(page.extract_text() or "" for page in reader.pages)
    assert pdf.startswith(b"%PDF")
    assert len(reader.pages) >= 3
    assert "PEMERINTAH KABUPATEN MALANG" in text
    assert "LP-2026-0042" in text
    assert "Verifikasi dokumen digital LaporPak" in text
    assert "LAMPIRAN FOTO LAPORAN" in text


def test_letterhead_requires_private_logo_and_official_identity():
    metadata = {
        "regency_type": "Kabupaten",
        "regency": "Malang",
        "district": "Pakis",
        "address": "Jl. Merdeka No. 1",
        "postal_code": "65154",
    }
    assert missing_letterhead_fields(metadata) == [
        "logo_storage_path",
        "document_official_name",
        "document_official_title",
    ]


def test_logo_validation_checks_signature_and_size():
    assert validate_logo(png_bytes(), "image/png") == "png"
    try:
        validate_logo(b"not-an-image", "image/png")
    except ValueError as error:
        assert "PNG atau JPEG" in str(error)
    else:
        raise AssertionError("invalid logo must be rejected")


class RecordingGateway(OpenClawGateway):
    def __init__(self) -> None:
        self.calls: list[tuple[str, ...]] = []

    def _run(self, *args: str, timeout: int = 40) -> str:
        self.calls.append(args)
        if args[:2] == ("agents", "bindings"):
            return "[]"
        return "{}"


def test_whatsapp_accounts_are_provisioned_open_without_groups():
    gateway = RecordingGateway()
    gateway.ensure_whatsapp_account("laporpak-test", "Desa Test")
    calls = [" ".join(call) for call in gateway.calls]
    assert any('dmPolicy "open" --strict-json' in call for call in calls)
    assert any('allowFrom ["*"] --strict-json' in call for call in calls)
    assert any('groupPolicy "disabled" --strict-json' in call for call in calls)


def test_pairing_enables_photo_hook_before_requesting_qr():
    gateway = RecordingGateway()
    gateway.start_pairing("laporpak-test")
    assert gateway.calls[0] == (
        "config",
        "set",
        'channels.whatsapp.accounts["laporpak-test"].pluginHooks.messageReceived',
        "true",
        "--strict-json",
    )
    assert gateway.calls[1][:4] == ("gateway", "call", "web.login.start", "--json")


def test_restart_accepts_windows_shim_timeout_when_gateway_is_healthy(monkeypatch):
    gateway = RecordingGateway()
    monkeypatch.setattr(gateway_module, "_gateway_restarted_at", 0.0)
    gateway._run = lambda *args, **kwargs: (_ for _ in ()).throw(
        OpenClawGatewayTimeoutError("timeout")
    )
    gateway.whatsapp_statuses = lambda: ({"default": {"connected": True}}, "default")
    gateway.restart()
