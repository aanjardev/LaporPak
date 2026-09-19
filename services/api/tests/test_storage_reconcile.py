from contextlib import nullcontext

from app.db import storage_reconcile


class Result:
    def scalars(self):
        return iter(["kept/photo.jpg"])


class Connection:
    def execute(self, _statement):
        return Result()


class Engine:
    def connect(self):
        return nullcontext(Connection())


def test_storage_reconcile_is_dry_run_by_default(monkeypatch):
    deleted = []
    monkeypatch.setattr(storage_reconcile, "engine", Engine())
    monkeypatch.setattr(
        storage_reconcile,
        "storage_objects",
        lambda _bucket: {"kept/photo.jpg", "orphan/photo.jpg"},
    )
    monkeypatch.setattr(
        storage_reconcile,
        "delete_storage_object",
        lambda bucket, path: deleted.append((bucket, path)),
    )

    assert storage_reconcile.reconcile("report-attachments") == (2, 1)
    assert deleted == []

    assert storage_reconcile.reconcile("report-attachments", delete=True) == (2, 1)
    assert deleted == [("report-attachments", "orphan/photo.jpg")]
