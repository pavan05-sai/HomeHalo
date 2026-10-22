from __future__ import annotations
from fastapi import Request
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
import logging

logger = logging.getLogger(__name__)


def error_response(code: str, message: str, status: int, details=None):
    body = {"error": {"code": code, "message": message}}
    if details is not None:
        body["error"]["details"] = details
    return JSONResponse(status_code=status, content=body)


class AppError(Exception):
    def __init__(self, code: str, message: str, status: int, details=None):
        self.code = code
        self.message = message
        self.status = status
        self.details = details


class NotFoundError(AppError):
    def __init__(self, message: str = "Not found"):
        super().__init__("not_found", message, 404)


class ConflictError(AppError):
    def __init__(self, message: str = "Conflict"):
        super().__init__("conflict", message, 409)


class ValidationError(AppError):
    def __init__(self, message: str, details=None):
        super().__init__("validation_error", message, 422, details)


class InvalidRequestError(AppError):
    def __init__(self, message: str):
        super().__init__("invalid_request", message, 400)


class DatabaseUnavailableError(AppError):
    def __init__(self, hint: str = "Check MONGODB_URI, Atlas Network Access IP allowlist, and DB user credentials."):
        super().__init__("database_unavailable", f"Database unavailable. {hint}", 503)


async def app_error_handler(request: Request, exc: AppError):
    return error_response(exc.code, exc.message, exc.status, exc.details)


async def validation_error_handler(request: Request, exc: RequestValidationError):
    details = [{"loc": e["loc"], "msg": e["msg"]} for e in exc.errors()]
    return error_response("validation_error", "Request validation failed", 422, details)
