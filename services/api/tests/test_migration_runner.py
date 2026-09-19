from contextlib import nullcontext
from types import SimpleNamespace

import pytest

from app.db import migrate


class Result:
    def __init__(self, rows=(), scalar=None):
        self.rows = list(rows)
        self.scalar_value = scalar

    def __iter__(self):
        return iter(self.rows)

    def scalar(self):
        return self.scalar_value


class Connection:
    def __init__(self, *, fail_sql=False, has_schema=None):
        self.ledger = {}
        self.executed_migrations = []
        self.fail_sql = fail_sql
        self.has_schema = has_schema

    def execute(self, statement, parameters=None):
        sql = " ".join(str(statement).split())
        if sql.startswith("select version,filename,checksum"):
            return Result(
                SimpleNamespace(version=version, filename=name, checksum=checksum)
                for version, (name, checksum) in sorted(self.ledger.items())
            )
        if sql.startswith("select to_regclass"):
            return Result(scalar=self.has_schema)
        if sql.startswith("insert into public.laporpak_schema_migrations"):
            self.ledger[parameters["version"]] = (
                parameters["filename"],
                parameters["checksum"],
            )
        if "create table example(id int)" in sql or "select broken" in sql:
            self.executed_migrations.append(sql)
            if self.fail_sql:
                raise RuntimeError("migration failed")
        return Result()


class Engine:
    def __init__(self, connection):
        self.connection = connection

    def begin(self):
        return nullcontext(self.connection)


def test_apply_is_repeatable_and_records_checksum(monkeypatch, tmp_path):
    migration = tmp_path / "0001_example.sql"
    migration.write_text(
        "begin;\ncreate table example(id int);\nselect 'DATA UJI%';\ncommit;\n",
        encoding="utf-8",
    )
    connection = Connection()
    monkeypatch.setattr(migrate, "MIGRATION_DIR", tmp_path)
    monkeypatch.setattr(migrate, "engine", Engine(connection))

    migrate.command_apply()
    migrate.command_apply()

    assert len(connection.executed_migrations) == 1
    assert 1 in connection.ledger
    assert "begin;" not in connection.executed_migrations[0].lower()
    assert "commit;" not in connection.executed_migrations[0].lower()
    assert "DATA UJI%" in connection.executed_migrations[0]


def test_failed_migration_is_not_recorded(monkeypatch, tmp_path):
    (tmp_path / "0001_failure.sql").write_text("select broken;", encoding="utf-8")
    connection = Connection(fail_sql=True)
    monkeypatch.setattr(migrate, "MIGRATION_DIR", tmp_path)
    monkeypatch.setattr(migrate, "engine", Engine(connection))

    with pytest.raises(RuntimeError, match="migration failed"):
        migrate.command_apply()
    assert connection.ledger == {}


def test_changed_applied_checksum_is_rejected(tmp_path):
    path = tmp_path / "0001_example.sql"
    path.write_text("select 1;", encoding="utf-8")
    migration = migrate.Migration(version=1, path=path, checksum="new")
    with pytest.raises(RuntimeError, match="Checksum changed"):
        migrate.verify_checksums([migration], {1: (path.name, "old")})


def test_existing_schema_requires_baseline_before_apply(monkeypatch, tmp_path):
    (tmp_path / "0014_next.sql").write_text("select 1;", encoding="utf-8")
    connection = Connection(has_schema="reports")
    monkeypatch.setattr(migrate, "MIGRATION_DIR", tmp_path)
    monkeypatch.setattr(migrate, "engine", Engine(connection))

    with pytest.raises(RuntimeError, match="run baseline first"):
        migrate.command_apply()
