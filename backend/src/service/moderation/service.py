from uuid import UUID

from sqlalchemy import Select, case, func, select

from core.errors import BadRequestError, NotFoundError
from database.relational_db import Report, User
from domain.dating import AuditEntityType
from domain.moderation import (
    ModerationReportItem,
    ModerationReportListResponse,
    ModerationReportStatus,
    ModerationReportSummary,
    ModerationReviewAction,
    ModerationReviewRequest,
    ModerationReviewResponse,
    ModerationUserRef,
)
from service.matchmaking import BaseDatingService


class ModerationReportNotFoundError(NotFoundError):
    def __init__(self) -> None:
        super().__init__("Moderation report not found")


class ModerationService(BaseDatingService):
    async def get_report_summary(self) -> ModerationReportSummary:
        counts_stmt = (
            select(Report.review_status, func.count(Report.id))
            .group_by(Report.review_status)
        )
        rows = await self.uow.session.execute(counts_stmt)
        counts_by_status = {
            str(status): count for status, count in rows.all()
        }
        banned_targets = await self.uow.session.scalar(
            select(func.count(func.distinct(Report.target_user_id)))
            .join(User, User.id == Report.target_user_id)
            .where(User.banned.is_(True))
        )
        total_reports = await self.uow.session.scalar(select(func.count(Report.id)))
        return ModerationReportSummary(
            total_reports=int(total_reports or 0),
            pending_reports=int(counts_by_status.get(ModerationReportStatus.PENDING.value, 0)),
            resolved_reports=int(counts_by_status.get(ModerationReportStatus.RESOLVED.value, 0)),
            dismissed_reports=int(counts_by_status.get(ModerationReportStatus.DISMISSED.value, 0)),
            banned_targets=int(banned_targets or 0),
        )

    async def list_reports(
        self,
        *,
        status: ModerationReportStatus | None,
        limit: int,
    ) -> ModerationReportListResponse:
        stmt: Select = select(Report).order_by(
            case(
                (Report.review_status == ModerationReportStatus.PENDING.value, 0),
                (Report.review_status == ModerationReportStatus.RESOLVED.value, 1),
                else_=2,
            ),
            Report.created_at.desc(),
        ).limit(limit)
        if status is not None:
            stmt = stmt.where(Report.review_status == status.value)
        rows = await self.uow.session.scalars(stmt)
        reports = list(rows.all())
        return ModerationReportListResponse(
            items=await self._serialize_reports(reports)
        )

    async def review_report(
        self,
        *,
        report_id: UUID,
        reviewer: User,
        payload: ModerationReviewRequest,
    ) -> ModerationReviewResponse:
        report = await self.uow.session.get(Report, report_id)
        if report is None:
            raise ModerationReportNotFoundError()
        if payload.status == ModerationReportStatus.PENDING:
            raise BadRequestError("Pending is not a valid review resolution")

        target = await self.user_repo.get_by_id(report.target_user_id)
        if target is None:
            raise ModerationReportNotFoundError()

        report.review_status = payload.status.value
        report.review_note = payload.review_note
        report.reviewed_at = self.now()
        report.reviewer_user_id = reviewer.id
        report.review_action = (
            ModerationReviewAction.BANNED.value
            if payload.ban_user
            else ModerationReviewAction.NONE.value
        )

        if payload.ban_user and not target.banned:
            target.banned = True
            target.bump_auth_version()

        await self.add_audit_event(
            event_type="admin_report_reviewed",
            entity_type=AuditEntityType.REPORT,
            entity_id=str(report.id),
            actor_user_id=reviewer.id,
            payload={
                "target_user_id": str(report.target_user_id),
                "review_status": payload.status.value,
                "review_action": report.review_action,
            },
        )
        await self.uow.commit()
        return ModerationReviewResponse(
            report=(await self._serialize_reports([report]))[0]
        )

    async def _serialize_reports(self, reports: list[Report]) -> list[ModerationReportItem]:
        if not reports:
            return []

        user_ids: list[UUID] = []
        for report in reports:
            user_ids.extend([report.actor_user_id, report.target_user_id])
            if report.reviewer_user_id is not None:
                user_ids.append(report.reviewer_user_id)
        unique_user_ids = list(dict.fromkeys(user_ids))
        users = await self.user_repo.list_by_ids(unique_user_ids)
        users_by_id = {user.id: user for user in users}

        def to_user_ref(user_id: UUID) -> ModerationUserRef:
            user = users_by_id[user_id]
            return ModerationUserRef(
                id=user.id,
                email=user.email,
                display_name=user.resolved_display_name or user.email,
                avatar_url=user.avatar_url,
                banned=bool(user.banned),
            )

        items: list[ModerationReportItem] = []
        for report in reports:
            reviewer = (
                to_user_ref(report.reviewer_user_id)
                if report.reviewer_user_id is not None and report.reviewer_user_id in users_by_id
                else None
            )
            items.append(
                ModerationReportItem(
                    id=report.id,
                    created_at=report.created_at,
                    source_context=report.source_context,
                    category=report.category,
                    description=report.description,
                    related_message_id=report.related_message_id,
                    also_block=report.also_block,
                    review_status=report.review_status,
                    review_action=report.review_action,
                    reviewed_at=report.reviewed_at,
                    review_note=report.review_note,
                    actor=to_user_ref(report.actor_user_id),
                    target=to_user_ref(report.target_user_id),
                    reviewer=reviewer,
                )
            )
        return items
