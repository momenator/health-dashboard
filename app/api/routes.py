import json

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db import get_db
from app.models import HealthRecord, Report
from app.schemas import HealthRecordCreate, HealthRecordRead, ReportGenerateRequest, ReportRead
from app.services.reporting import ReportingService


router = APIRouter(prefix="/api/v1")


@router.post("/health-records", response_model=HealthRecordRead, status_code=201)
def create_health_record(payload: HealthRecordCreate, db: Session = Depends(get_db)) -> HealthRecord:
    record = HealthRecord(**payload.model_dump())
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


@router.get("/health-records", response_model=list[HealthRecordRead])
def list_health_records(db: Session = Depends(get_db)) -> list[HealthRecord]:
    return list(db.scalars(select(HealthRecord).order_by(HealthRecord.recorded_at.desc())))


@router.get("/health-records/{record_id}", response_model=HealthRecordRead)
def get_health_record(record_id: int, db: Session = Depends(get_db)) -> HealthRecord:
    record = db.get(HealthRecord, record_id)
    if not record:
        raise HTTPException(status_code=404, detail="Health record not found")
    return record


@router.post("/reports/generate", response_model=ReportRead, status_code=201)
def generate_report(payload: ReportGenerateRequest, db: Session = Depends(get_db)) -> ReportRead:
    record = db.get(HealthRecord, payload.health_record_id)
    if not record:
        raise HTTPException(status_code=404, detail="Health record not found")

    service = ReportingService(get_settings())
    report = service.generate_report(db, record)
    return _serialize_report(report)


@router.get("/reports", response_model=list[ReportRead])
def list_reports(db: Session = Depends(get_db)) -> list[ReportRead]:
    reports = db.scalars(select(Report).order_by(Report.created_at.desc()))
    return [_serialize_report(report) for report in reports]


@router.get("/reports/{report_id}", response_model=ReportRead)
def get_report(report_id: int, db: Session = Depends(get_db)) -> ReportRead:
    report = db.get(Report, report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    return _serialize_report(report)


@router.get("/reports/{report_id}/download")
def download_report(report_id: int, db: Session = Depends(get_db)) -> Response:
    report = db.get(Report, report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    service = ReportingService(get_settings())
    pdf = service.load_pdf(report)
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="report-{report_id}.pdf"'},
    )


def _serialize_report(report: Report) -> ReportRead:
    return ReportRead(
        id=report.id,
        health_record_id=report.health_record_id,
        status=report.status,
        risk_level=report.risk_level,
        summary=report.summary,
        recommendations=json.loads(report.recommendations),
        pdf_uri=report.pdf_uri,
        model_name=report.model_name,
        created_at=report.created_at,
    )
