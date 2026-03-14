from __future__ import annotations

import os
from uuid import UUID, uuid4

from fastapi import HTTPException, Request, Security, status
from fastapi.security import APIKeyHeader


service_token_header = APIKeyHeader(name="X-Service-Token", auto_error=False)


def _request_trace_id(request: Request) -> UUID:
    raw_trace_id = request.headers.get("X-Trace-Id", "").strip()
    if raw_trace_id:
        try:
            return UUID(raw_trace_id)
        except ValueError:
            pass
    return uuid4()


def require_service_token(
    request: Request,
    token: str | None = Security(service_token_header),
) -> None:
    expected_token = os.getenv("ML_SERVICE_TOKEN", "dev-ml-token")
    if token == expected_token:
        return

    trace_id = _request_trace_id(request)
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail={
            "error_code": "invalid_service_token",
            "message": "Invalid service token.",
            "trace_id": str(trace_id),
        },
    )
