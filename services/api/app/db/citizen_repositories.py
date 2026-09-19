from uuid import UUID

from sqlalchemy import text
from sqlalchemy.orm import Session


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
              and (:ticket is null or r.ticket_number = :ticket)
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
              and (:ticket is null or r.ticket_number = :ticket)
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
        if embedding is None:
            return list(
                self.session.execute(
                    text("""
                select d.id document_id, c.id chunk_id, d.title, d.source_url,
                       c.content
                from public.knowledge_chunks c
                join public.knowledge_documents d on d.id=c.document_id
                where d.administrative_unit_id=:unit
                  and d.is_active
                  and d.processing_status in ('pending', 'processing', 'ready')
                  and coalesce(d.metadata->>'approval_status', 'approved')='approved'
                  and (cast(:service_key as text) is null or
                       coalesce(c.metadata->>'service_key', d.metadata->>'service_key')=cast(:service_key as text))
                  and c.search_vector @@ websearch_to_tsquery('simple', :question)
                order by ts_rank_cd(
                    c.search_vector,
                    websearch_to_tsquery('simple', :question)
                ) desc
                limit 5
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
                text("""
            with fts as (
              select c.id, row_number() over(order by ts_rank_cd(c.search_vector, websearch_to_tsquery('simple', :question)) desc) rank
              from public.knowledge_chunks c join public.knowledge_documents d on d.id=c.document_id
              where d.administrative_unit_id=:unit and d.is_active
                and d.processing_status in ('pending', 'processing', 'ready')
                and coalesce(d.metadata->>'approval_status', 'approved')='approved'
                and (cast(:service_key as text) is null or coalesce(c.metadata->>'service_key', d.metadata->>'service_key')=cast(:service_key as text))
                and c.search_vector @@ websearch_to_tsquery('simple', :question) limit 20
            ), semantic as (
              select c.id, row_number() over(order by c.embedding <=> cast(:embedding as vector)) rank
              from public.knowledge_chunks c join public.knowledge_documents d on d.id=c.document_id
              where d.administrative_unit_id=:unit and d.is_active and d.processing_status='ready'
                and coalesce(d.metadata->>'approval_status', 'approved')='approved'
                and c.embedding is not null
                and (cast(:service_key as text) is null or coalesce(c.metadata->>'service_key', d.metadata->>'service_key')=cast(:service_key as text)) limit 20
            ), ranked as (
              select coalesce(f.id,s.id) id, coalesce(1.0/(60+f.rank),0)+coalesce(1.0/(60+s.rank),0) score
              from fts f full join semantic s on s.id=f.id
            )
            select d.id document_id, c.id chunk_id, d.title, d.source_url, c.content
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
