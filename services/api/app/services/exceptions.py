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
