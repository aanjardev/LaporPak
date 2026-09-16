# Product Requirement Document V3 — AI Village Service Agent

**Subtitle:** Smart Village Public Service Platform  
**Status:** Draft — Development & Hackathon Reference  
**Version:** V3  
**Last updated:** 22 August 2026  
**Primary channel:** WhatsApp  
**Core flows:** ASK · REPORT · REQUEST · TRACK  
**Positioning:** AI public-service gateway; AI as decision support, not final authority.

> Transkripsi Markdown dari PRD V3 PDF. Tata letak tabel dan pemenggalan baris dinormalisasi; isi kebutuhan produk dipertahankan. PRD V2 yang disebut sebagai sumber tidak tersedia dalam repository ini. Penanda sitasi internal pada halaman terakhir PDF tidak dapat ditelusuri, sehingga tidak direproduksi sebagai tautan.

Update basis: PRD V2 plus the latest risk/guardrail work and prior recommendations in this project. The V2 foundation is preserved; safety, human verification, workflow boundaries, data minimization, auditability, and fail-safe behavior are now explicit requirements.

## 1. Product Overview

AI Village Service Agent adalah platform layanan publik desa berbasis Conversational AI yang menjadikan WhatsApp sebagai pintu utama interaksi warga dengan pemerintah desa. Produk berkembang dari AI reporting assistant menjadi AI public service gateway yang dapat menerima laporan, menjawab pertanyaan layanan, membantu pengajuan administrasi, dan menghubungkan warga dengan perangkat desa.

V3 mempertahankan empat kemampuan inti PRD V2—ASK, REPORT, REQUEST, dan TRACK—namun menegaskan batas kewenangan AI: AI memahami, mengumpulkan, merangkum, dan merekomendasikan; aturan/workflow mengontrol aksi; perangkat desa memegang keputusan untuk tindakan yang berdampak pada warga.

## 2. Product Vision & Principles

Visi: satu pintu digital untuk bertanya, melapor, mengajukan layanan, dan memantau proses pemerintahan desa.

| Principle | Product implication |
|---|---|
| AI Understands | Memahami bahasa natural, konteks, intent, dan entitas. |
| Rules Control | Tidak boleh melewati SOP, role permission, atau workflow. |
| Humans Approve | Aksi/keputusan berisiko memerlukan verifikasi manusia. |
| Least Privilege | AI hanya mendapat tool dan data yang diperlukan. |
| Data Minimization | Simpan data minimum yang diperlukan untuk layanan dan audit. |
| Fail Safely | Confidence rendah → klarifikasi/human handoff, bukan menebak. |
| Auditability | Aksi penting memiliki jejak siapa, apa, kapan, dasar, dan hasil. |
| AI Is Not the Source of Truth | Informasi resmi berasal dari SOP/knowledge base/data pemerintah. |

## 3. Product Problem

- Warga tidak mengetahui prosedur layanan desa.
- Warga harus datang langsung untuk informasi sederhana.
- Warga kesulitan membuat laporan dengan format yang benar.
- Warga tidak mengetahui perkembangan permintaan.
- Perangkat desa menerima laporan melalui banyak kanal yang tidak terintegrasi.
- Input dan pengolahan laporan masih manual.
- Perangkat desa sulit memprioritaskan laporan.
- Data pelayanan belum dimanfaatkan menjadi insight.

## 4. Target Users

| User | Needs / Jobs |
|---|---|
| Warga Desa | Melapor, bertanya, mengajukan layanan, dan melacak status. |
| Perangkat Desa | Mengelola laporan, memproses permintaan, memvalidasi, dan menggunakan insight AI. |
| Instansi Terkait | Koordinasi lintas layanan bila diperlukan. |

## 5. Product Capability

| Flow | Purpose | V3 behavior |
|---|---|---|
| ASK | Informasi layanan desa | Jawab dari knowledge base resmi; jika tidak yakin, klarifikasi/handoff. |
| REPORT | Laporan masalah/kejadian | Collect → validate → deduplicate → ticket → triage → human handling. |
| REQUEST | Pengajuan layanan administrasi | Collect required data → validate → human approval → status tracking. |
| TRACK | Pantau proses | Tampilkan status dari system-of-record; AI tidak mengarang status. |

## 6. User Journey & Workflow

1. Citizen message → intent detection → confidence check → flow selection → collect required information → validation → action/ticket → confirmation → tracking.
2. Ambiguous/low-confidence input → clarification → if unresolved, human handoff.
3. Consequential action → approval gate → authorized execution → audit event.

### 6.1 REQUEST Safety Boundary

| Level | AI may do | Human / rule required |
|---|---|---|
| L0 Inform | Explain procedure and requirements. | Source must be official/approved knowledge. |
| L1 Prepare | Collect and structure citizen-provided data. | Validate required fields before submission. |
| L2 Propose | Generate draft/recommendation/summary. | Human approval before consequential action. |
| L3 Execute | Only explicitly permitted low-risk workflow actions. | Authorization, audit log, deterministic rules. |

AI must never independently approve, reject, alter official records, or make consequential decisions outside the configured workflow.

## 7. AI Architecture Concept

AI menggunakan intent classification untuk memahami kebutuhan pengguna. V3 memperluasnya menjadi orchestration yang guardrail-aware.

| Layer | Responsibility |
|---|---|
| Channel | WhatsApp conversation and media intake. |
| Intent & Entity | Information Request, Complaint Report, Service Request, Tracking; extract only needed entities. |
| Policy / Guardrail | Confidence, authorization, tool allowlist, sensitivity, workflow state, rate/cost limits. |
| Knowledge | Approved village SOP, service requirements, status data, authoritative sources. |
| Workflow / Tools | Create/update ticket, retrieve status, route, summarize, notify—only permitted tools. |
| Human Review | Validation, approval, escalation, exception handling. |
| Audit | Record critical events and AI-assisted decisions/actions. |

## 8. Solution Components

| Component | Responsibilities |
|---|---|
| Citizen AI Agent | WhatsApp, NLU, context, guided conversation, safe handoff. |
| Government Dashboard | Complaint/service management, validation, status workflow, triage, analytics. |
| AI Engine | Intent classification, entity extraction, summarization, recommendation. |
| Knowledge Base | Approved SOP/service information; versioned and maintained. |
| Guardrail Layer | Policy enforcement, confidence thresholds, permissions, validation, rate/cost controls. |
| Audit & Monitoring | Action logs, failure events, model/flow metrics, admin review. |

## 9. MVP Scope — Reprioritized

| Priority | Scope |
|---|---|
| MUST HAVE | WhatsApp AI Agent; REPORT end-to-end; ASK from approved knowledge; ticketing; admin dashboard; status management; human verification; confidence/fallback; audit trail; basic security/access control. |
| SHOULD HAVE | REQUEST prototype for one service; TRACK; duplicate detection; AI summarization/priority recommendation; attachment validation; basic analytics. |
| FUTURE | Multi-department workflow; automated routing; predictive issue detection; advanced personalization; map monitoring; broader service automation; smart-city integration. |

Rationale: prototype harus menunjukkan manfaat AI tanpa menjadikan AI autonomy sebagai risiko operasional utama.

## 10. Functional Requirements

| ID | Requirement |
|---|---|
| FR-01 | System menerima percakapan melalui WhatsApp. |
| FR-02 | System mendeteksi intent dan confidence. |
| FR-03 | System meminta klarifikasi jika intent/entitas tidak cukup jelas. |
| FR-04 | System membuat tiket setelah validation gate terpenuhi. |
| FR-05 | Admin dapat memproses dan memvalidasi permintaan. |
| FR-06 | System memberikan update status berdasarkan system-of-record. |
| FR-07 | System menyimpan histori yang diperlukan untuk continuity dan audit. |
| FR-08 | System mencegah AI melakukan aksi di luar permission/tool policy. |
| FR-09 | System menyediakan human handoff untuk low-confidence, sensitive, atau exceptional cases. |
| FR-10 | System menandai potensi duplikasi laporan/permintaan. |
| FR-11 | System mencatat audit event untuk ticket creation, status changes, approvals, escalations, dan tool actions. |
| FR-12 | Admin dapat mengaktifkan manual mode/kill switch untuk menghentikan aksi AI. |

## 11. Non-Functional Requirements

| Area | Requirement |
|---|---|
| Performance | Response cepat dan stabil; timeout/failure → safe fallback. |
| Security | Protection of citizen data, authentication/authorization, least privilege, secure attachment handling. |
| Scalability | Mendukung multi-desa tanpa mencampur data antar-tenant. |
| AI Governance | Human verification, transparent recommendations, confidence-aware behavior, auditability. |
| Reliability | Idempotent ticket creation dan retry-safe integration untuk mencegah duplicate actions. |
| Maintainability | Rules/SOP/guardrails dapat diperbarui tanpa mengubah seluruh conversation logic. |

## 12. Risk & Guardrail Requirements

| ID | Risk | Prevention | Detection | Fallback | Human | Data stored |
|---|---|---|---|---|---|---|
| R01 | Spam/abuse | Rate limit; abuse detection | Volume spike | Throttle/queue | Admin | Minimal abuse metadata |
| R02 | Token/cost explosion | Budget/rate limits; max turns | Cost anomaly | Degrade/manual | Admin | Usage metrics |
| R03 | Prompt injection | Untrusted input; tool allowlist | Policy violation | Refuse tool action | Security/admin | Security event |
| R04 | Hallucination | RAG/approved KB | Low evidence/confidence | Clarify/handoff | Admin | Query + source |
| R05 | Wrong intent | Confidence + confirmation | Low confidence | Clarify | Admin | Intent/confidence |
| R06 | Wrong routing | Deterministic routing | Invalid route | Review queue | Admin | Route event |
| R07 | False report | Confirm key facts | Inconsistency | Mark unverified | Officer | Verification state |
| R08 | Duplicate report | Similarity + confirmation | Duplicate score | Link/merge | Admin | Duplicate relation |
| R09 | Invalid document | File/type validation | Validation failure | Hold/reject | Officer | Document metadata |
| R10 | Sensitive data leakage | Minimize + access control | DLP/permission event | Redact/block | Security | Security log |
| R11 | Excessive data collection | Required-field schema | Unexpected fields | Ignore/redact | Admin | Minimal audit data |
| R12 | Unauthorized tracking | Identity/session check | Mismatch | Deny/handoff | Admin | Access event |
| R13 | Admin overload | Queue prioritization | Backlog risk | Escalate/queue | Supervisor | Operational metrics |
| R14 | Outdated service info | Versioned KB + owner | Stale content | Show last-updated/handoff | Content owner | KB version |
| R15 | Wrong jurisdiction | Scope rules | Out-of-scope request | Explain/handoff | Officer | Routing record |
| R16 | Excessive AI agency | Tool allowlist + approval | Blocked action attempt | No-op/handoff | Admin | Tool event |
| R17 | Low-confidence execution | Hard confidence gate | Below threshold | Ask/handoff | Officer | Confidence |
| R18 | Voice transcription error | Confirm critical fields | Low ASR confidence | Repeat/typed confirm | Officer | Needed transcript data |
| R19 | Image misinterpretation | Image as evidence, not fact | Ambiguous image | Clarify | Officer | Media metadata |
| R20 | Malicious attachment | Scan/isolate | Threat detection | Block/quarantine | Security | Security metadata |
| R21 | Duplicate service request | Idempotency + status check | Existing request | Link existing | Admin | Request relation |
| R22 | Identity spoofing | Session/account verification | Mismatch | Deny sensitive action | Admin | Access event |
| R23 | AI unavailable | Health check + fallback | Provider outage | Manual mode | Admin | Incident event |
| R24 | DB/system failure | Retries/transactions/backups | Read/write failure | Queue/recovery | Admin | System event |
| R25 | Missing audit trail | Mandatory audit middleware | Missing event | Block action | Admin | Audit event |
| R26 | Local-language misunderstanding | Language detection + clarification | Repeated misunderstanding | Human handoff | Officer | Language signal |
| R27 | Knowledge-base poisoning | Curated sources + approval | Unexpected KB change | Rollback/version pin | Content owner | Version history |
| R28 | Blind trust in AI recommendations | Label recommendations | Mismatch | Do not execute | Officer | Recommendation + decision |

## 13. Guardrail Rules by Flow

| Flow | Hard rules |
|---|---|
| ASK | Only approved knowledge for factual service info; show uncertainty; never fabricate policy/procedure. |
| REPORT | Minimum facts; confirm critical details; mark unverified claims; deduplicate; AI may summarize/priority-suggest, not declare final truth. |
| REQUEST | Separate preparation from execution; validate fields; human approval for consequential actions; never invent documents/status. |
| TRACK | Read status from system-of-record; verify access; never infer or fabricate status. |

## 14. Human-in-the-Loop Matrix

| Case | AI role | Human role |
|---|---|---|
| Low-risk ASK | Answer | Exception handling |
| Normal REPORT | Collect/structure/summarize | Validate/triage as needed |
| High-impact REPORT | Collect + flag | Decide response/priority |
| REQUEST | Prepare draft/data | Approve/execute consequential action |
| Low confidence | Clarify | Take over if unresolved |
| Security/privacy anomaly | Detect/stop | Investigate |
| AI/system outage | Fallback | Manual processing |

## 15. Data Architecture & Retention Principles

- Pisahkan secara logis identity warga, conversation, ticket, operational status, dan audit/security records.
- Gunakan role-based access dan least privilege.
- Simpan hanya data yang diperlukan untuk service delivery, continuity, accountability, dan approved analytics.
- Jangan gunakan raw conversation history sebagai sumber bebas untuk setiap future task.
- Sensitive fields dimasking/redacted bila tidak diperlukan.
- Retention period harus configurable sesuai kebutuhan operasional dan governance; V3 tidak menetapkan satu periode universal.

## 16. Fail-Safe, Manual Mode & Kill Switch

- Confidence rendah → klarifikasi atau human handoff.
- Knowledge source unavailable/stale → jangan mengarang informasi resmi.
- Tool authorization gagal → jangan mencari jalur alternatif yang tidak berwenang.
- Database/system unavailable → queue atau manual processing.
- Security anomaly → block risky action dan alert operator berwenang.
- Admin dapat menonaktifkan AI actions sementara dashboard manual tetap berjalan.

## 17. Success Metrics — Updated

| Dimension | Metric |
|---|---|
| Citizen | Conversation completion; active users; satisfaction; self-service rate; handoff rate. |
| Government | First response time; resolution time; requests resolved; backlog; duplicate rate; administrative effort saved. |
| AI Quality | Intent accuracy; entity accuracy; grounded-answer rate; hallucination/error rate; low-confidence rate. |
| Safety | Unauthorized action rate (target: 0); audit coverage; blocked unsafe tool calls; sensitive-data incident rate; duplicate-action rate. |
| Reliability | AI availability; ticket creation success; failed/queued operations; recovery time. |

## 18. Product Differentiation

1. Conversational AI, bukan static digital forms.
2. WhatsApp sebagai single gateway.
3. Satu agent untuk ASK, REPORT, REQUEST, TRACK.
4. Percakapan diubah menjadi structured workflow/ticket di dashboard pemerintah.
5. AI berguna tetapi bounded oleh rules, permissions, human approval, dan auditability.
6. Service data menjadi structured insight untuk decision support.

## 19. MVP Definition of Done

- Warga dapat menyelesaikan REPORT dari WhatsApp hingga tracked ticket.
- ASK menggunakan approved knowledge base.
- Low-confidence input tidak menghasilkan jawaban/aksi yang dibuat-buat.
- Admin dapat validate, change status, dan handle escalation.
- Consequential REQUEST memiliki approval gate.
- Duplicate protection aktif pada core ticket creation.
- Consequential tool actions memiliki audit event.
- AI dapat dimatikan dan manual mode tetap dapat memproses layanan.
- Basic authentication, authorization, data minimization, dan attachment controls tersedia.
- Demo mencakup happy path dan adversarial/failure scenarios.

## 20. Security & AI Safety Testing Checklist

- Prompt injection tidak dapat melewati tool permissions.
- Unauthorized user tidak dapat mengambil TRACK data warga lain.
- Sensitive fields tidak muncul pada konteks yang tidak berwenang.
- Spam/repeated messages terkena rate limit.
- Retry tidak membuat duplicate ticket/action.
- Malicious attachment diblokir atau dikarantina.
- Unsupported policy question menghasilkan uncertainty/handoff.
- Ambiguous message memicu clarification.
- AI/provider/database outage mengaktifkan fallback.
- Kill switch menghentikan AI action tanpa menghilangkan manual operation.
- Semua consequential action menghasilkan audit event.

## 21. Roadmap

| Phase | Scope |
|---|---|
| Phase 1 — Safe AI Reporting Assistant | REPORT end-to-end, dashboard, triage, guardrails, audit, manual fallback. |
| Phase 2 — AI Village Information Assistant | ASK grounded on approved village knowledge. |
| Phase 3 — Digital Service Request Processing | REQUEST untuk selected service dengan explicit human approval. |
| Phase 4 — Integrated Smart Village Governance Platform | Broader workflows, cross-department coordination, advanced analytics/prediction. |

## 22. Concise Jury Q&A

| Question | Answer |
|---|---|
| Mengapa WhatsApp? | Mengurangi friction karena warga dapat melapor dengan percakapan natural tanpa belajar form/aplikasi baru. |
| Apakah AI mengambil keputusan pemerintah? | Tidak. AI adalah decision support; rules dan perangkat desa mengendalikan keputusan/aksi konsekuensial. |
| Bagaimana mencegah halusinasi? | Approved knowledge/RAG, confidence gate, source-of-truth separation, dan human handoff. |
| Bagaimana menghadapi prompt berbahaya? | Input dianggap untrusted; tool allowlist, policy guardrail, dan permission check membatasi aksi. |
| Bagaimana jika AI salah memahami? | Klarifikasi, konfirmasi fakta penting, lalu human handoff bila belum terselesaikan. |
| Bagaimana jika AI mati? | Manual/fallback mode menjaga proses layanan tetap berjalan. |
| Apa nilai tambah dibanding chatbot? | Agent terhubung ke workflow: laporan menjadi tiket, status dapat dilacak, dan admin memperoleh structured insight. |

## Appendix — Change Summary from PRD V2

| V2 | V3 update |
|---|---|
| Intent classification | Intent + confidence gate + clarification/handoff. |
| AI recommendation | Explicitly decision support; no blind execution. |
| Ticket creation | Validation + idempotency/duplicate protection + audit. |
| Generic security | Least privilege, data minimization, access checks, attachment controls. |
| Human verification | Approval gates, human-in-loop matrix, manual mode, kill switch. |
| Analytics | Operational + AI safety metrics. |
| Prototype admin service | REQUEST safety boundary separates preparation from consequential execution. |
| Roadmap | Safe REPORT/ASK first; broader automation later. |

### Source Boundary

PRD V2 secara eksplisit menjadi basis untuk overview, vision, problems, users, capabilities, architecture, components, MVP, requirements, metrics, differentiation, dan roadmap. V3 mempertahankan struktur tersebut dan menambahkan requirement guardrail/risk yang telah dikembangkan dalam proyek. Item tambahan tersebut perlu divalidasi saat implementasi agar selaras dengan SOP desa dan kebutuhan deployment nyata.
