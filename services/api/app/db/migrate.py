import argparse
import hashlib
import re
from dataclasses import dataclass
from pathlib import Path

from sqlalchemy import text

from app.db.session import engine

MIGRATION_DIR = Path(__file__).resolve().parents[4] / "database" / "migrations"
LEDGER_SQL = """
create table if not exists public.laporpak_schema_migrations (
    version integer primary key,
    filename text not null unique,
    checksum text not null,
    applied_at timestamptz not null default now()
)
"""


@dataclass(frozen=True)
class Migration:
    version: int
    path: Path
    checksum: str


def migrations() -> list[Migration]:
    result = []
    for path in MIGRATION_DIR.glob("*.sql"):
        match = re.match(r"^(\d{4})_", path.name)
        if not match:
            continue
        result.append(
            Migration(
                version=int(match.group(1)),
                path=path,
                checksum=hashlib.sha256(path.read_bytes()).hexdigest(),
            )
        )
    return sorted(result, key=lambda item: item.version)


def ensure_ledger(connection) -> None:
    connection.execute(text(LEDGER_SQL))


def applied(connection) -> dict[int, tuple[str, str]]:
    return {
        row.version: (row.filename, row.checksum)
        for row in connection.execute(
            text(
                "select version,filename,checksum "
                "from public.laporpak_schema_migrations order by version"
            )
        )
    }


def verify_checksums(known: list[Migration], recorded) -> None:
    by_version = {item.version: item for item in known}
    for version, (filename, checksum) in recorded.items():
        migration = by_version.get(version)
        if migration is None or migration.path.name != filename:
            raise RuntimeError(
                f"Recorded migration {version:04d} is missing or renamed"
            )
        if migration.checksum != checksum:
            raise RuntimeError(f"Checksum changed for applied migration {filename}")


def validate_baseline(connection) -> None:
    required_tables = {
        "admin_accounts",
        "admin_unit_memberships",
        "administrative_units",
        "channel_integrations",
        "citizens",
        "conversation_messages",
        "conversation_sessions",
        "knowledge_analytics",
        "knowledge_chunks",
        "knowledge_documents",
        "knowledge_templates",
        "report_attachments",
        "report_categories",
        "report_status_history",
        "reports",
        "resolution_confirmations",
        "routing_rules",
        "service_request_status_history",
        "service_request_types",
        "service_requests",
        "village_profiles",
    }
    present = set(
        connection.execute(
            text(
                "select table_name from information_schema.tables "
                "where table_schema='public'"
            )
        ).scalars()
    )
    missing = sorted(required_tables - present)
    if missing:
        raise RuntimeError(f"Baseline tables missing: {', '.join(missing)}")

    extensions = set(
        connection.execute(
            text(
                "select extname from pg_extension where extname in ('vector','postgis')"
            )
        ).scalars()
    )
    if "vector" not in extensions:
        raise RuntimeError("Baseline extension missing: vector")

    buckets = {
        row.id: row.public
        for row in connection.execute(
            text(
                "select id,public from storage.buckets "
                "where id in ('knowledge-files','report-attachments')"
            )
        )
    }
    if buckets != {"knowledge-files": False, "report-attachments": False}:
        raise RuntimeError("Required private Storage buckets are missing or public")

    required_columns = {
        ("admin_accounts", "auth_user_id"),
        ("reports", "administrative_unit_id"),
        ("reports", "idempotency_key"),
        ("knowledge_documents", "administrative_unit_id"),
        ("knowledge_documents", "source_type"),
        ("knowledge_documents", "content"),
        ("report_attachments", "storage_path"),
        ("service_requests", "idempotency_key"),
    }
    columns = set(
        connection.execute(
            text(
                "select table_name,column_name from information_schema.columns "
                "where table_schema='public'"
            )
        ).tuples()
    )
    missing_columns = sorted(required_columns - columns)
    if missing_columns:
        raise RuntimeError(f"Baseline columns missing: {missing_columns}")

    required_indexes = {
        "conversation_messages_external_message_id_key",
        "idx_knowledge_chunks_embedding",
        "idx_knowledge_chunks_fts",
        "idx_reports_administrative_unit",
        "idx_service_requests_unit",
        "resolution_confirmations_retry_key",
    }
    indexes = set(
        connection.execute(
            text(
                "select indexname from pg_indexes where schemaname='public'"
            )
        ).scalars()
    )
    missing_indexes = sorted(required_indexes - indexes)
    if missing_indexes:
        raise RuntimeError(f"Baseline indexes missing: {', '.join(missing_indexes)}")

    required_constraints = {
        "reports_coordinates_pair_check",
        "reports_idempotency_pair_check",
        "reports_location_available_check",
        "report_status_history_new_status_check",
    }
    constraints = set(
        connection.execute(
            text(
                "select conname from pg_constraint c "
                "join pg_namespace n on n.oid=c.connamespace "
                "where n.nspname='public'"
            )
        ).scalars()
    )
    missing_constraints = sorted(required_constraints - constraints)
    if missing_constraints:
        raise RuntimeError(
            f"Baseline constraints missing: {', '.join(missing_constraints)}"
        )

    unsecured = (
        connection.execute(
            text(
                "select relname from pg_class c join pg_namespace n on n.oid=c.relnamespace "
                "where n.nspname='public' and relname in "
                "('admin_accounts','admin_unit_memberships','citizens','reports',"
                "'report_attachments','knowledge_documents','service_requests') "
                "and not relrowsecurity"
            )
        )
        .scalars()
        .all()
    )
    if unsecured:
        raise RuntimeError(f"RLS is disabled for: {', '.join(unsecured)}")

    unsafe_grants = connection.execute(
        text(
            "select grantee,table_name,privilege_type "
            "from information_schema.role_table_grants "
            "where table_schema='public' and grantee in ('anon','authenticated') "
            "and table_name in ('admin_accounts','admin_unit_memberships','citizens',"
            "'reports','report_attachments','knowledge_documents','service_requests')"
        )
    ).all()
    if unsafe_grants:
        raise RuntimeError("Baseline contains direct anon/authenticated table grants")


def strip_transaction_wrapper(sql: str) -> str:
    sql = re.sub(r"^\s*begin\s*;", "", sql, count=1, flags=re.IGNORECASE)
    return re.sub(r"commit\s*;\s*$", "", sql, count=1, flags=re.IGNORECASE)


def command_status() -> None:
    known = migrations()
    with engine.begin() as connection:
        ensure_ledger(connection)
        recorded = applied(connection)
        verify_checksums(known, recorded)
    for item in known:
        print(
            f"{'applied' if item.version in recorded else 'pending'} {item.path.name}"
        )


def command_baseline(through: int) -> None:
    known = [item for item in migrations() if item.version <= through]
    with engine.begin() as connection:
        ensure_ledger(connection)
        recorded = applied(connection)
        verify_checksums(migrations(), recorded)
        has_schema = connection.execute(
            text("select to_regclass('public.reports')")
        ).scalar()
        if has_schema and not recorded and through != 13:
            raise RuntimeError("Existing schema must baseline exactly through 0013")
        validate_baseline(connection)
        for item in known:
            connection.execute(
                text(
                    "insert into public.laporpak_schema_migrations "
                    "(version,filename,checksum) values (:version,:filename,:checksum) "
                    "on conflict (version) do nothing"
                ),
                {
                    "version": item.version,
                    "filename": item.path.name,
                    "checksum": item.checksum,
                },
            )
    print(f"Baseline recorded through {through:04d}")


def command_apply() -> None:
    known = migrations()
    with engine.begin() as connection:
        ensure_ledger(connection)
        recorded = applied(connection)
        verify_checksums(known, recorded)
        has_schema = connection.execute(
            text("select to_regclass('public.reports')")
        ).scalar()
        if has_schema and not recorded:
            raise RuntimeError("Existing schema has no ledger; run baseline first")
    for item in known:
        if item.version in recorded:
            continue
        with engine.begin() as connection:
            connection.execute(
                text(
                    strip_transaction_wrapper(
                        item.path.read_text(encoding="utf-8")
                    )
                )
            )
            connection.execute(
                text(
                    "insert into public.laporpak_schema_migrations "
                    "(version,filename,checksum) values (:version,:filename,:checksum)"
                ),
                {
                    "version": item.version,
                    "filename": item.path.name,
                    "checksum": item.checksum,
                },
            )
        print(f"Applied {item.path.name}")


def main() -> None:
    parser = argparse.ArgumentParser(description="LaporPak checksum migration runner")
    subparsers = parser.add_subparsers(dest="command", required=True)
    subparsers.add_parser("status")
    baseline = subparsers.add_parser("baseline")
    baseline.add_argument("--through", type=int, required=True)
    subparsers.add_parser("apply")
    arguments = parser.parse_args()
    if arguments.command == "status":
        command_status()
    elif arguments.command == "baseline":
        command_baseline(arguments.through)
    else:
        command_apply()


if __name__ == "__main__":
    main()
