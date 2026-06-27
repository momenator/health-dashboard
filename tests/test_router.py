"""Tests for intent routing logic."""

from app.router import classify_intent, _is_private_data_request


class TestPrivateDataDetection:
    """Test private data request detection."""

    def test_phone_number_request(self):
        assert _is_private_data_request("What are the phone numbers of patients?")

    def test_name_request(self):
        assert _is_private_data_request("Give me patient names from the TB dataset")

    def test_cin_request(self):
        assert _is_private_data_request("Show me the CIN for each record")

    def test_photo_request(self):
        assert _is_private_data_request("Get patient photographs")

    def test_commcare_request(self):
        assert _is_private_data_request("Show me the CommCare links")

    def test_normal_question_not_flagged(self):
        assert not _is_private_data_request("How many TB screenings are there?")

    def test_district_name_not_flagged(self):
        assert not _is_private_data_request("What is the name of the district with most screenings?")


class TestIntentClassification:
    """Test rule-based intent classification."""

    def test_chart_intent(self):
        result = classify_intent("Show TB screenings by district as a bar chart")
        assert result.intent == "chart"

    def test_data_lookup_intent(self):
        result = classify_intent("How many TB screenings are in the dataset?")
        assert result.intent == "data_lookup"

    def test_explanation_intent(self):
        result = classify_intent("Explain what data confidence means")
        assert result.intent == "explanation"

    def test_recommendation_intent(self):
        result = classify_intent("Give recommendations for improving follow-up")
        assert result.intent == "recommendation"

    def test_report_intent(self):
        result = classify_intent("Write an annual report paragraph about TB screening")
        assert result.intent == "report_text"

    def test_prediction_intent(self):
        result = classify_intent("Predict which patients will be lost to follow-up")
        assert result.intent == "prediction"

    def test_entity_extraction_tb(self):
        result = classify_intent("How many TB screenings are in the dataset?")
        assert "tb_patient_journey" in result.entities.get("tables", [])

    def test_entity_extraction_ambulance(self):
        result = classify_intent("Show ambulance trips by district")
        assert "ambulance_trips" in result.entities.get("tables", [])
