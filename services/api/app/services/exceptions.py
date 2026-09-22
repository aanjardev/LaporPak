class ReportServiceError(Exception):
    """Base exception for report persistence operations."""


class CategoryNotFoundError(ReportServiceError):
    def __init__(self, category_code: str) -> None:
        super().__init__(f"Active category not found: {category_code}")
        self.category_code = category_code


class ReportNotFoundError(ReportServiceError):
    def __init__(self, report_id: object) -> None:
        super().__init__(f"Report not found: {report_id}")
        self.report_id = report_id


class ReportPersistenceError(ReportServiceError):
    def __init__(self, operation: str) -> None:
        super().__init__(f"Report persistence failed during {operation}")
        self.operation = operation


class DuplicateOperationError(ReportServiceError):
    def __init__(self) -> None:
        super().__init__("Idempotency key was already used for another payload")


class InvalidSenderIdentityError(ReportServiceError):
    def __init__(self) -> None:
        super().__init__("Sender phone number is invalid")


class InvalidAttachmentError(ReportServiceError):
    def __init__(self, message: str) -> None:
        super().__init__(message)
        self.message = message


class AttachmentUnavailableError(ReportServiceError):
    def __init__(self) -> None:
        super().__init__("Report attachment is unavailable")


class InvalidStatusTransitionError(ReportServiceError):
    def __init__(self, old_status: str, new_status: str) -> None:
        super().__init__(f"Invalid status transition: {old_status} -> {new_status}")
        self.old_status = old_status
        self.new_status = new_status


class ReportRateLimitError(ReportServiceError):
    def __init__(self) -> None:
        super().__init__("Report rate limit exceeded")


class DocumentDeliveryUnknownError(ReportServiceError):
    def __init__(self) -> None:
        super().__init__("Document delivery outcome requires operator review")


class ReferralAcceptanceRequiredError(ReportServiceError):
    def __init__(self) -> None:
        super().__init__("Forwarded status requires accepted referral evidence")
