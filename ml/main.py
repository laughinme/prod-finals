from __future__ import annotations

from typing import Any
from uuid import UUID, uuid4

from fastapi import Depends, FastAPI, HTTPException, Request, status, BackgroundTasks
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from datetime import datetime, timezone
from ml.service.auth import require_service_token
from ml.service.runtime import MlRuntime
from ml.service.schemas import (
    AckResponse,
    CompatibilityExplanationRequest,
    CompatibilityExplanationResponse,
    ErrorResponse,
    MatchOutcomeRequest,
    MlHealthResponse,
    MlStatus,
    RecommendationRequest,
    RecommendationResponse,
    SwipeFeedbackRequest,
    UserProfileUpdateRequest,
    TransactionSyncRequest
)


def _coerce_trace_id(raw: str | None) -> UUID:
    if raw:
        try:
            return UUID(str(raw))
        except ValueError:
            pass
    return uuid4()


def _build_error_response(
    *,
    error_code: str,
    message: str,
    status_code: int,
    trace_id: UUID | None = None,
    details: dict[str, Any] | None = None,
) -> JSONResponse:
    payload = ErrorResponse(
        error_code=error_code,
        message=message,
        details=details,
        trace_id=trace_id or uuid4(),
    )
    return JSONResponse(status_code=status_code, content=payload.model_dump(mode="json"))


runtime = MlRuntime()

app = FastAPI(
    title="T-Match Internal ML API (Backend <-> ML Service)",
    version="1.0.0",
    summary="Внутренний контракт для ранжирования, explanations и feedback.",
    description=(
        "Внутренний контракт между main backend и ML service.\n\n"
        "Main backend владеет бизнес-состоянием, ML service владеет scoring/explanations/feedback ingestion."
    ),
    openapi_version="3.1.0",
    openapi_tags=[
        {"name": "health", "description": "Состояние ML-компонента и деградации"},
        {"name": "recommendations", "description": "Ранжирование кандидатов"},
        {"name": "feedback", "description": "Feedback-события для обучения и аналитики"},
        {"name": "explanations", "description": "Безопасные объяснения в виде reason codes"},
    ],
    servers=[{"url": "http://ml-service:8080", "description": "ML service"}],
)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(
    request: Request,
    exc: RequestValidationError,
) -> JSONResponse:
    trace_id = _coerce_trace_id(request.headers.get("X-Trace-Id"))
    return _build_error_response(
        error_code="invalid_request",
        message="Invalid request payload.",
        status_code=status.HTTP_400_BAD_REQUEST,
        trace_id=trace_id,
        details={"validation_errors": exc.errors()},
    )


@app.exception_handler(HTTPException)
async def http_exception_handler(
    request: Request,
    exc: HTTPException,
) -> JSONResponse:
    detail = exc.detail
    if isinstance(detail, dict):
        trace_id = _coerce_trace_id(detail.get("trace_id") or request.headers.get("X-Trace-Id"))
        return _build_error_response(
            error_code=str(detail.get("error_code", "request_error")),
            message=str(detail.get("message", "Request failed.")),
            status_code=exc.status_code,
            trace_id=trace_id,
            details=detail.get("details"),
        )

    trace_id = _coerce_trace_id(request.headers.get("X-Trace-Id"))
    return _build_error_response(
        error_code="request_error",
        message=str(detail),
        status_code=exc.status_code,
        trace_id=trace_id,
    )


@app.get(
    "/v1/health",
    tags=["health"],
    operation_id="getMlHealth",
    response_model=MlHealthResponse,
    dependencies=[Depends(require_service_token)],
    responses={503: {"model": ErrorResponse}},
)
async def get_ml_health() -> MlHealthResponse | JSONResponse:
    health = runtime.get_health()
    if health.status == MlStatus.down:
        return _build_error_response(
            error_code="service_unavailable",
            message="ML service is down.",
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        )
    return health


@app.post(
    "/v1/recommendations",
    tags=["recommendations"],
    operation_id="postRecommendations",
    response_model=RecommendationResponse,
    dependencies=[Depends(require_service_token)],
    responses={400: {"model": ErrorResponse}, 401: {"model": ErrorResponse}, 422: {"model": ErrorResponse}},
)
async def post_recommendations(payload: RecommendationRequest) -> RecommendationResponse:
    if (
        payload.hard_filters
        and payload.hard_filters.age_min is not None
        and payload.hard_filters.age_max is not None
    ):
        if payload.hard_filters.age_min > payload.hard_filters.age_max:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={
                    "error_code": "invalid_hard_filters",
                    "message": "age_min should be less than or equal to age_max.",
                    "trace_id": str(payload.trace_id),
                },
            )
    return runtime.recommend(payload)


@app.post(
    "/v1/interactions/swipe",
    tags=["feedback"],
    operation_id="postSwipeFeedback",
    response_model=AckResponse,
    status_code=status.HTTP_202_ACCEPTED,
    dependencies=[Depends(require_service_token)],
    responses={400: {"model": ErrorResponse}, 401: {"model": ErrorResponse}},
)
async def post_swipe_feedback(payload: SwipeFeedbackRequest) -> AckResponse:
    if payload.shown_at and payload.shown_at > payload.acted_at:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error_code": "invalid_request",
                "message": "shown_at must be less than or equal to acted_at.",
                "trace_id": str(payload.trace_id),
            },
        )
    return runtime.process_swipe_feedback(payload)


@app.post(
    "/v1/interactions/match-outcome",
    tags=["feedback"],
    operation_id="postMatchOutcome",
    response_model=AckResponse,
    status_code=status.HTTP_202_ACCEPTED,
    dependencies=[Depends(require_service_token)],
    responses={400: {"model": ErrorResponse}, 401: {"model": ErrorResponse}},
)
async def post_match_outcome(payload: MatchOutcomeRequest) -> AckResponse:
    if payload.user_a_id == payload.user_b_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error_code": "invalid_request",
                "message": "user_a_id and user_b_id must be different.",
                "trace_id": str(payload.trace_id),
            },
        )
    return runtime.save_feedback_event(
        event_id=payload.event_id,
        trace_id=payload.trace_id,
        event_type="match_outcome",
    )


@app.post(
    "/v1/explanations/compatibility",
    tags=["explanations"],
    operation_id="postCompatibilityExplanation",
    response_model=CompatibilityExplanationResponse,
    dependencies=[Depends(require_service_token)],
    responses={400: {"model": ErrorResponse}, 401: {"model": ErrorResponse}, 404: {"model": ErrorResponse}},
)
async def post_compatibility_explanation(
    payload: CompatibilityExplanationRequest,
) -> CompatibilityExplanationResponse:
    try:
        return runtime.explain_compatibility(payload)
    except LookupError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error_code": "pair_not_found",
                "message": "User pair is not available in ML context.",
                "trace_id": str(payload.trace_id),
            },
        ) from None


@app.post(
    "/v1/profile/favorites",
    tags=["feedback"],
    operation_id="postProfileFavorites",
    response_model=AckResponse,
    status_code=status.HTTP_202_ACCEPTED,
    dependencies=[Depends(require_service_token)],
    responses={400: {"model": ErrorResponse}, 401: {"model": ErrorResponse}},
)
async def post_update_favorites(payload: UserProfileUpdateRequest) -> AckResponse:
    return runtime.update_user_profile_favorites(
        user_id=payload.user_id,
        favorite_categories=payload.favorite_categories,
        trace_id=payload.trace_id,
        preferred_hour=payload.preferred_activity_hour,
    )


@app.post(
    "/v1/profiles/onboarding",
    tags=["onboarding"],
    operation_id="postOnboarding",
    response_model=AckResponse,
    status_code=status.HTTP_202_ACCEPTED,
    dependencies=[Depends(require_service_token)],
)
async def post_onboarding(
    payload: UserProfileUpdateRequest,
    background_tasks: BackgroundTasks
) -> AckResponse:
    runtime.update_user_profile_favorites(
        user_id=payload.user_id,
        favorite_categories=payload.favorite_categories,
        trace_id=payload.trace_id,
        preferred_hour=payload.preferred_activity_hour
    )
    if payload.import_transactions:
        background_tasks.add_task(
            runtime.pull_and_process_user_transactions, 
            user_id=payload.user_id, 
            trace_id=payload.trace_id
        )
    return AckResponse(status=AckStatus.accepted, received_at=datetime.now(timezone.utc))

@app.post(
    "/v1/transactions/sync",
    tags=["onboarding", "events"],
    operation_id="postSyncTransactions",
    response_model=AckResponse,
    status_code=status.HTTP_202_ACCEPTED,
    dependencies=[Depends(require_service_token)],
)
async def post_sync_transactions(
    payload: TransactionSyncRequest, 
    background_tasks: BackgroundTasks
) -> AckResponse:
    """Event-driven обновление профиля. ML-логика выполняется в фоне."""
    
    # Отправляем тяжелую задачу (CatBoost, Scaler, Qdrant Upsert) в фон
    background_tasks.add_task(
        runtime.process_transactions_sync_background,
        payload
    )
    
    return AckResponse(
        status=AckStatus.accepted, 
        received_at=datetime.now(timezone.utc)
    )