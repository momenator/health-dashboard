from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field


# ---------- Chat request / response ----------

class UserContext(BaseModel):
    """Optional user context passed with chat requests."""
    language: str | None = None
    role: str | None = None


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=4000, examples=["How many TB screenings are in the dataset?"])
    conversation_id: str | None = None
    user_context: UserContext | None = None


class EvidenceItem(BaseModel):
    table: str
    metric: str | None = None
    value: Any | None = None
    dimension: str | None = None
    filters: dict[str, Any] | None = None


class ChartPayload(BaseModel):
    type: Literal["bar", "line", "pie", "table"]
    title: str
    xKey: str | None = None
    yKey: str | None = None
    data: list[dict[str, Any]]


ResponseType = Literal[
    "answer",
    "chart",
    "recommendation",
    "report_text",
    "clarification",
    "error",
]


class ChatResponse(BaseModel):
    type: ResponseType
    answer: str
    chart: ChartPayload | None = None
    evidence: list[EvidenceItem] | None = None
    quality_note: str | None = None
    suggested_followups: list[str] | None = None


# ---------- Intent classification ----------

Intent = Literal[
    "data_lookup",
    "chart",
    "explanation",
    "recommendation",
    "report_text",
    "prediction",
    "clarification",
]


class RouterResult(BaseModel):
    intent: Intent
    entities: dict[str, Any] = Field(default_factory=dict)
    confidence: float = 1.0
