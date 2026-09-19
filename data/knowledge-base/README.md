# Reviewed knowledge import

`reviewed-manifest.json` stays empty until village administrators approve the
source text and its village mapping. Every entry must provide `title`,
`administrative_unit_id`, `source_type`, `source_reference`, and `content`;
there is deliberately no default village. `source_reference` identifies the
reviewed file, URL, or approval record without granting the backend access to it.

Run the validated, idempotent import from `services/api`:

```bash
uv run python -m app.services.knowledge_import ../../data/knowledge-base/reviewed-manifest.json
```

An existing document with the same content checksum and village is skipped.
Legacy rows missing canonical fields remain untouched and are excluded from the
editor and embedding workflow.
