from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class HealthRecordBase(BaseModel):
    patient_id: str = Field(..., examples=["patient-001"])
    patient_name: str = Field(..., examples=["Jane Doe"])
    age: int = Field(..., ge=0, le=120)
    gender: str = Field(..., examples=["female"])
    notes: str | None = None
    source: str = "manual"
    heart_rate: float | None = Field(default=None, ge=0)
    systolic_bp: float | None = Field(default=None, ge=0)
    diastolic_bp: float | None = Field(default=None, ge=0)
    blood_glucose: float | None = Field(default=None, ge=0)
    spo2: float | None = Field(default=None, ge=0, le=100)
    weight_kg: float | None = Field(default=None, ge=0)
    height_cm: float | None = Field(default=None, ge=0)
    recorded_at: datetime | None = None


class HealthRecordCreate(HealthRecordBase):
    pass


class HealthRecordRead(HealthRecordBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime


class ReportGenerateRequest(BaseModel):
    health_record_id: int


class ReportRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    health_record_id: int
    status: str
    risk_level: str
    summary: str
    recommendations: list[str]
    pdf_uri: str
    model_name: str
    created_at: datetime


class ReportNotificationPayload(BaseModel):
    report_id: int
    health_record_id: int
    status: str
    pdf_uri: str
