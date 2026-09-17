begin;

revoke all on table
    public.citizens,
    public.administrative_units,
    public.report_categories,
    public.reports,
    public.report_attachments,
    public.report_status_history,
    public.conversation_sessions,
    public.conversation_messages,
    public.routing_rules,
    public.knowledge_documents,
    public.knowledge_chunks
from anon, authenticated;

revoke all on sequence public.report_ticket_number_seq
from anon, authenticated;

alter function public.set_updated_at()
    set search_path = '';

revoke execute on function public.set_updated_at()
from public, anon, authenticated;

revoke execute on function public.next_report_ticket_number()
from public, anon, authenticated;

alter default privileges for role postgres in schema public
    revoke all on tables from anon, authenticated;

alter default privileges for role postgres in schema public
    revoke all on sequences from anon, authenticated;

alter default privileges for role postgres in schema public
    revoke all on functions from anon, authenticated;

commit;
