from uuid import UUID

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.config import settings


class CitizenRepository:
    def __init__(self, session: Session) -> None:
        self.session = session

    def track_reports(
        self, phone: str, ticket: str | None, unit_id: UUID
    ) -> list[dict]:
        return list(
            self.session.execute(
                text("""
            select r.id, r.ticket_number, 'report' kind,
                   coalesce(r.summary, r.description) summary, r.status,
                   r.created_at, coalesce(max(h.created_at), r.created_at) status_changed_at
            from public.reports r
            join public.citizens c on c.id = r.citizen_id
            left join public.report_status_history h on h.report_id = r.id
            where c.phone_number = :phone and r.administrative_unit_id = :unit
              and (cast(:ticket as text) is null or
                   r.ticket_number = cast(:ticket as text))
            group by r.id order by r.created_at desc limit 5
        """),
                {"phone": phone, "ticket": ticket, "unit": unit_id},
            )
            .mappings()
            .all()
        )

    def track_requests(
        self, phone: str, ticket: str | None, unit_id: UUID
    ) -> list[dict]:
        return list(
            self.session.execute(
                text("""
            select r.id, r.ticket_number, 'service_request' kind,
                   ('Surat domisili: ' || r.purpose) summary, r.status,
                   r.created_at, coalesce(max(h.created_at), r.created_at) status_changed_at
            from public.service_requests r
            join public.citizens c on c.id = r.citizen_id
            left join public.service_request_status_history h on h.service_request_id = r.id
            where c.phone_number = :phone and r.administrative_unit_id = :unit
              and (cast(:ticket as text) is null or
                   r.ticket_number = cast(:ticket as text))
            group by r.id order by r.created_at desc limit 5
        """),
                {"phone": phone, "ticket": ticket, "unit": unit_id},
            )
            .mappings()
            .all()
        )

    def history(self, kind: str, item_ids: list[UUID]) -> list[dict]:
        if not item_ids:
            return []
        if kind == "report":
            sql = "select report_id item_id, new_status, created_at from public.report_status_history where report_id = any(:ids) order by created_at"
        else:
            sql = "select service_request_id item_id, new_status, created_at from public.service_request_status_history where service_request_id = any(:ids) order by created_at"
        return list(self.session.execute(text(sql), {"ids": item_ids}).mappings().all())

    def hybrid_search(
        self,
        question: str,
        embedding: list[float] | None,
        unit_id: UUID,
        service_key: str | None,
    ) -> list[dict]:
        review_filter = (
            "d.review_status in ('approved','demo')"
            if settings.app_env == "development"
            else "d.review_status='approved'"
        )
        if embedding is None:
            return list(
                self.session.execute(
                    text(rf"""
                with query as (
                  select to_tsquery(
                    'simple',
                    string_agg(quote_literal(term), ' | ')
                  ) value
                  from unnest(
                    tsvector_to_array(to_tsvector('simple', :question))
                  ) term
                  where term not in (
                    'apa', 'apakah', 'bagaimana', 'gimana', 'ini', 'itu',
                    'yang', 'paling', 'hari', 'saya', 'mau', 'ingin', 'bisa',
                    'dan', 'atau', 'di', 'ke', 'dari', 'untuk', 'dengan'
                  )
                )
                select d.id document_id, c.id chunk_id, d.title, d.source_url,
                       c.content, d.review_status
                from public.knowledge_chunks c
                join public.knowledge_documents d on d.id=c.document_id
                cross join query q
                where d.administrative_unit_id=:unit
                  and d.is_active
                  and d.processing_status in ('pending', 'processing', 'ready')
                  and {review_filter}
                  and (cast(:service_key as text) is null or
                       coalesce(c.metadata->>'service_key', d.metadata->>'service_key')=cast(:service_key as text))
                  and q.value is not null
                  and to_tsvector(
                    'simple', coalesce(d.title,'') || ' ' || c.content
                  ) @@ q.value
                order by ts_rank_cd(
                  to_tsvector('simple', coalesce(d.title,'') || ' ' || c.content),
                  q.value
                ) desc
                limit 1
            """),
                    {
                        "question": question,
                        "unit": unit_id,
                        "service_key": service_key,
                    },
                )
                .mappings()
                .all()
            )
        vector = "[" + ",".join(str(value) for value in embedding) + "]"
        return list(
            self.session.execute(
                text(rf"""
            with query as (
              select to_tsquery(
                'simple',
                string_agg(quote_literal(term), ' | ')
              ) value
              from unnest(
                tsvector_to_array(to_tsvector('simple', :question))
              ) term
              where term not in (
                'apa', 'apakah', 'bagaimana', 'gimana', 'ini', 'itu',
                'yang', 'paling', 'hari', 'saya', 'mau', 'ingin', 'bisa',
                'dan', 'atau', 'di', 'ke', 'dari', 'untuk', 'dengan'
              )
            ), fts as (
              select c.id, row_number() over(order by ts_rank_cd(
                to_tsvector('simple', coalesce(d.title,'') || ' ' || c.content),
                q.value
              ) desc) rank
              from public.knowledge_chunks c join public.knowledge_documents d on d.id=c.document_id
              cross join query q
              where d.administrative_unit_id=:unit and d.is_active
                and d.processing_status in ('pending', 'processing', 'ready')
                and {review_filter}
                and (cast(:service_key as text) is null or coalesce(c.metadata->>'service_key', d.metadata->>'service_key')=cast(:service_key as text))
                and q.value is not null
                and to_tsvector(
                  'simple', coalesce(d.title,'') || ' ' || c.content
                ) @@ q.value limit 20
            ), semantic as (
              select c.id, row_number() over(order by c.embedding <=> cast(:embedding as vector)) rank
              from public.knowledge_chunks c join public.knowledge_documents d on d.id=c.document_id
              where d.administrative_unit_id=:unit and d.is_active and d.processing_status='ready'
                and {review_filter}
                and c.embedding is not null
                and (cast(:service_key as text) is null or coalesce(c.metadata->>'service_key', d.metadata->>'service_key')=cast(:service_key as text)) limit 20
            ), ranked as (
              select coalesce(f.id,s.id) id, coalesce(1.0/(60+f.rank),0)+coalesce(1.0/(60+s.rank),0) score
              from fts f full join semantic s on s.id=f.id
            )
            select d.id document_id, c.id chunk_id, d.title, d.source_url,
                   c.content, d.review_status
            from ranked r join public.knowledge_chunks c on c.id=r.id
            join public.knowledge_documents d on d.id=c.document_id
            order by r.score desc limit 5
        """),
                {
                    "question": question,
                    "embedding": vector,
                    "unit": unit_id,
                    "service_key": service_key,
                },
            )
            .mappings()
            .all()
        )
