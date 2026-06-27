import io
import json
from datetime import datetime

import httpx
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.models import HealthRecord, Report
from app.schemas import ReportNotificationPayload
from app.services.bedrock import BedrockReportService
from app.services.storage import ReportStorageService


class ReportingService:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.bedrock = BedrockReportService(settings)
        self.storage = ReportStorageService(settings)

    def generate_report(self, db: Session, record: HealthRecord) -> Report:
        ai_result = self.bedrock.generate_report(record)
        pdf_bytes = self._render_pdf(record, ai_result)
        filename = f"report-{record.id}-{int(datetime.utcnow().timestamp())}.pdf"
        pdf_uri = self.storage.save_pdf(filename, pdf_bytes)

        report = Report(
            health_record_id=record.id,
            status="completed",
            risk_level=ai_result["risk_level"],
            summary=ai_result["summary"],
            recommendations=json.dumps(ai_result["recommendations"]),
            pdf_uri=pdf_uri,
            model_name=ai_result["model_name"],
        )
        db.add(report)
        db.commit()
        db.refresh(report)

        self._notify_frontend(report)
        return report

    def load_pdf(self, report: Report) -> bytes:
        return self.storage.load_pdf(report.pdf_uri)

    def _notify_frontend(self, report: Report) -> None:
        if not self.settings.lovable_webhook_url:
            return

        payload = ReportNotificationPayload(
            report_id=report.id,
            health_record_id=report.health_record_id,
            status=report.status,
            pdf_uri=report.pdf_uri,
        )
        headers = {}
        if self.settings.lovable_api_key:
            headers["Authorization"] = f"Bearer {self.settings.lovable_api_key}"

        try:
            with httpx.Client(timeout=10.0) as client:
                client.post(self.settings.lovable_webhook_url, json=payload.model_dump(), headers=headers)
        except httpx.HTTPError:
            pass

    def _render_pdf(self, record: HealthRecord, ai_result: dict) -> bytes:
        buffer = io.BytesIO()
        pdf = canvas.Canvas(buffer, pagesize=A4)
        width, height = A4
        y = height - 20 * mm

        pdf.setTitle(f"Health Report {record.patient_id}")
        pdf.setFont("Helvetica-Bold", 16)
        pdf.drawString(20 * mm, y, "Health Dashboard Report")
        y -= 10 * mm

        pdf.setFont("Helvetica", 11)
        lines = [
            f"Patient: {record.patient_name} ({record.patient_id})",
            f"Age / Gender: {record.age} / {record.gender}",
            f"Recorded at: {record.recorded_at.isoformat() if record.recorded_at else 'N/A'}",
            f"Risk level: {ai_result['risk_level']}",
            "",
            "Metrics:",
            f"- Heart rate: {record.heart_rate}",
            f"- Blood pressure: {record.systolic_bp}/{record.diastolic_bp}",
            f"- Blood glucose: {record.blood_glucose}",
            f"- SpO2: {record.spo2}",
            f"- Weight (kg): {record.weight_kg}",
            f"- Height (cm): {record.height_cm}",
            "",
            "Summary:",
            ai_result["summary"],
            "",
            "Recommendations:",
        ]
        lines.extend(f"- {item}" for item in ai_result["recommendations"])

        for line in lines:
            if y < 20 * mm:
                pdf.showPage()
                pdf.setFont("Helvetica", 11)
                y = height - 20 * mm
            pdf.drawString(20 * mm, y, line[:110])
            y -= 7 * mm

        pdf.save()
        buffer.seek(0)
        return buffer.read()
