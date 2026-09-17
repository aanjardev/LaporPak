from typing import Any

from fastapi import Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse


class APIError(Exception):
    def __init__(
        self,
        status_code: int,
        code: str,
        message: str,
        details: Any = None,
    ):
        self.status_code = status_code
        self.code = code
        self.message = message
        self.details = details


def error_response(error: APIError) -> JSONResponse:
    return JSONResponse(
        status_code=error.status_code,
        content=jsonable_encoder(
            {
                "error": {
                    "code": error.code,
                    "message": error.message,
                    "details": error.details,
                }
            }
        ),
    )


async def api_error_handler(_request: Request, error: APIError) -> JSONResponse:
    return error_response(error)


async def validation_error_handler(
    _request: Request,
    error: RequestValidationError,
) -> JSONResponse:
    return error_response(
        APIError(
            422,
            "VALIDATION_ERROR",
            "Request validation failed",
            error.errors(),
        )
    )
