import argparse

import httpx
from sqlalchemy import text

from app.core.config import settings
from app.db.session import engine
from app.services.reports import delete_storage_object

BUCKET_TABLE = {
    "report-attachments": ("report_attachments", "storage_path"),
    "knowledge-files": ("knowledge_documents", "storage_path"),
}


def storage_objects(bucket: str) -> set[str]:
    server_key = settings.supabase_secret_key or settings.supabase_service_role_key
    if not settings.supabase_url or not server_key:
        raise RuntimeError("Supabase Storage is not configured")
    result: set[str] = set()
    prefixes = [""]
    while prefixes:
        prefix = prefixes.pop()
        offset = 0
        while True:
            response = httpx.post(
                f"{settings.supabase_url.rstrip('/')}/storage/v1/object/list/{bucket}",
                headers={"Authorization": f"Bearer {server_key}", "apikey": server_key},
                json={
                    "prefix": prefix,
                    "limit": 100,
                    "offset": offset,
                    "sortBy": {"column": "name", "order": "asc"},
                },
                timeout=30,
            )
            response.raise_for_status()
            rows = response.json()
            for row in rows:
                name = row.get("name")
                if not name:
                    continue
                path = f"{prefix}/{name}" if prefix else name
                if row.get("id"):
                    result.add(path)
                else:
                    prefixes.append(path)
            if len(rows) < 100:
                break
            offset += len(rows)
    return result


def reconcile(bucket: str, *, delete: bool = False) -> tuple[int, int]:
    table, column = BUCKET_TABLE[bucket]
    with engine.connect() as connection:
        referenced = set(
            connection.execute(
                text(f"select {column} from public.{table} where {column} is not null")
            ).scalars()
        )
    objects = storage_objects(bucket)
    orphaned = objects - referenced
    if delete:
        for path in orphaned:
            delete_storage_object(bucket, path)
    return len(objects), len(orphaned)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Find orphaned private Storage objects"
    )
    parser.add_argument("--bucket", choices=sorted(BUCKET_TABLE), required=True)
    parser.add_argument("--delete", action="store_true")
    arguments = parser.parse_args()
    total, orphaned = reconcile(arguments.bucket, delete=arguments.delete)
    mode = "deleted" if arguments.delete else "dry-run"
    print(f"Bucket objects: {total}; orphaned: {orphaned}; mode: {mode}")


if __name__ == "__main__":
    main()
