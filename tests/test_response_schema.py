"""Tests for response schema validation."""

from app.schemas import ChatResponse, ChartPayload, EvidenceItem


class TestChatResponse:
    """Test ChatResponse schema."""

    def test_basic_answer(self):
        resp = ChatResponse(type="answer", answer="There are 4495 TB screenings.")
        assert resp.type == "answer"
        assert resp.chart is None

    def test_chart_response(self):
        chart = ChartPayload(
            type="bar",
            title="TB screenings by district",
            xKey="district",
            yKey="screenings",
            data=[{"district": "Ampanihy Ouest", "screenings": 2818}],
        )
        resp = ChatResponse(
            type="chart",
            answer="Here are TB screenings by district.",
            chart=chart,
            evidence=[EvidenceItem(table="tb_patient_journey", metric="count", value=4495)],
            quality_note="This uses high-confidence data.",
        )
        assert resp.type == "chart"
        assert resp.chart.type == "bar"
        assert len(resp.evidence) == 1

    def test_recommendation_response(self):
        resp = ChatResponse(
            type="recommendation",
            answer="Prioritize follow-up in Ampanihy Ouest.",
            evidence=[EvidenceItem(table="tb_patient_journey", metric="screenings", dimension="district")],
            quality_note="Operational recommendations only.",
            suggested_followups=["Show data as chart"],
        )
        assert resp.type == "recommendation"
        assert len(resp.suggested_followups) == 1

    def test_error_response(self):
        resp = ChatResponse(type="error", answer="Something went wrong.")
        assert resp.type == "error"

    def test_evidence_item(self):
        ev = EvidenceItem(
            table="tb_patient_journey",
            metric="screenings",
            value=4495,
            filters={"year": "2024"},
        )
        assert ev.table == "tb_patient_journey"
        assert ev.filters == {"year": "2024"}
