from enum import StrEnum


class Intent(StrEnum):
    REPORT = "REPORT"
    UNKNOWN = "UNKNOWN"


class ReportCategory(StrEnum):
    INFRASTRUCTURE = "infrastructure"
    PUBLIC_FACILITY = "public_facility"
    CLEANLINESS = "cleanliness"
    SECURITY = "security"
    SOCIAL = "social"
    ADMINISTRATION = "administration"
    OTHER = "other"


class ReportUrgency(StrEnum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class ReportStatus(StrEnum):
    PENDING_VERIFICATION = "pending_verification"
    VERIFIED = "verified"
    IN_PROGRESS = "in_progress"
    FORWARDED = "forwarded"
    RESOLVED = "resolved"
    REJECTED = "rejected"


class ReportSource(StrEnum):
    WHATSAPP = "whatsapp"
    DASHBOARD = "dashboard"
    API = "api"
    SEED = "seed"


class ReportActorType(StrEnum):
    SYSTEM = "system"
    ADMIN = "admin"
    AI = "ai"
    CITIZEN = "citizen"


class AdminRole(StrEnum):
    SYSTEM_ADMIN = "system_admin"
    VILLAGE_ADMIN = "village_admin"
