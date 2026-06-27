"""Tests for SQL validation guardrails."""

import pytest

from app.tools.athena import SQLValidationError, validate_sql

ALLOWED_TABLES = [
    "ambulance_causes",
    "ambulance_trips",
    "community_workers",
    "mchp_patient_support",
    "sensitization_activities",
    "tb_patient_journey",
    "reporting_catalog",
]


class TestSQLValidation:
    """Test SQL safety validation."""

    def test_valid_select(self):
        sql = "SELECT district, COUNT(*) FROM tb_patient_journey GROUP BY district"
        result = validate_sql(sql, ALLOWED_TABLES)
        assert "SELECT" in result
        assert "LIMIT" in result

    def test_valid_with_clause(self):
        sql = "WITH counts AS (SELECT district, COUNT(*) as c FROM tb_patient_journey GROUP BY district) SELECT * FROM counts"
        result = validate_sql(sql, ALLOWED_TABLES)
        assert result.startswith("WITH")

    def test_existing_limit_preserved(self):
        sql = "SELECT * FROM tb_patient_journey LIMIT 10"
        result = validate_sql(sql, ALLOWED_TABLES)
        assert "LIMIT 10" in result

    def test_blocked_insert(self):
        with pytest.raises(SQLValidationError):
            validate_sql("INSERT INTO tb_patient_journey VALUES (1)", ALLOWED_TABLES)

    def test_blocked_update(self):
        with pytest.raises(SQLValidationError):
            validate_sql("UPDATE tb_patient_journey SET district='x'", ALLOWED_TABLES)

    def test_blocked_delete(self):
        with pytest.raises(SQLValidationError):
            validate_sql("DELETE FROM tb_patient_journey", ALLOWED_TABLES)

    def test_blocked_drop(self):
        with pytest.raises(SQLValidationError):
            validate_sql("DROP TABLE tb_patient_journey", ALLOWED_TABLES)

    def test_blocked_alter(self):
        with pytest.raises(SQLValidationError):
            validate_sql("ALTER TABLE tb_patient_journey ADD COLUMN x INT", ALLOWED_TABLES)

    def test_blocked_create(self):
        with pytest.raises(SQLValidationError):
            validate_sql("CREATE TABLE new_table (id INT)", ALLOWED_TABLES)

    def test_blocked_private_table(self):
        with pytest.raises(SQLValidationError):
            validate_sql("SELECT * FROM private.patients", ALLOWED_TABLES)

    def test_blocked_raw_table(self):
        with pytest.raises(SQLValidationError):
            validate_sql("SELECT * FROM raw.data", ALLOWED_TABLES)

    def test_blocked_cleaned_table(self):
        with pytest.raises(SQLValidationError):
            validate_sql("SELECT * FROM cleaned.records", ALLOWED_TABLES)

    def test_blocked_quality_table(self):
        with pytest.raises(SQLValidationError):
            validate_sql("SELECT * FROM quality.checks", ALLOWED_TABLES)

    def test_unauthorized_table(self):
        with pytest.raises(SQLValidationError):
            validate_sql("SELECT * FROM secret_table", ALLOWED_TABLES)

    def test_must_start_with_select_or_with(self):
        with pytest.raises(SQLValidationError):
            validate_sql("EXPLAIN SELECT * FROM tb_patient_journey", ALLOWED_TABLES)

    def test_valid_join(self):
        sql = "SELECT t.district, a.cause FROM tb_patient_journey t JOIN ambulance_causes a ON t.district = a.district LIMIT 10"
        result = validate_sql(sql, ALLOWED_TABLES)
        assert "JOIN" in result
