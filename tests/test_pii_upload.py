"""Tests for upload-time PII sanitization."""

from pathlib import Path

from fastapi.testclient import TestClient
from openpyxl import Workbook

from app.core.config import get_settings
from app.main import app
from app.tools.pii import sanitize_uploaded_csv
from app.tools.schema import get_table_schemas


client = TestClient(app)


def test_upload_sanitizes_pii_before_reporting_dataset(tmp_path):
    settings = get_settings()
    original_data_dir = settings.data_dir
    original_raw_dir = settings.upload_raw_dir
    original_quarantine_dir = settings.upload_quarantine_dir
    original_script = settings.pii_sanitizer_script

    settings.data_dir = str(tmp_path / "reporting")
    settings.upload_raw_dir = str(tmp_path / "raw")
    settings.upload_quarantine_dir = str(tmp_path / "quarantine")
    settings.pii_sanitizer_script = None
    get_table_schemas.cache_clear()

    try:
        csv_body = (
            "patient_name,phone_number,record_id,district,notes\n"
            "Alice,+261 34 12 345 67,real-123,Ampanihy,Contact alice@example.org urgently\n"
        )
        response = client.post(
            "/upload-data",
            files={"file": ("TB Export.csv", csv_body, "text/csv")},
        )

        assert response.status_code == 200
        payload = response.json()
        assert payload["table_name"] == "uploaded_tb_export"
        assert payload["removed_columns"] == ["patient_name", "phone_number"]
        assert payload["pseudonymized_columns"] == ["record_id"]
        assert payload["redacted_cells"] == 1

        sanitized = Path(settings.data_dir) / "uploaded_tb_export.csv"
        text = sanitized.read_text(encoding="utf-8")
        assert "Alice" not in text
        assert "+261" not in text
        assert "alice@example.org" not in text
        assert "real-123" not in text
        assert "anon_" in text
        assert "[REDACTED]" in text
        assert "Ampanihy" in text
    finally:
        settings.data_dir = original_data_dir
        settings.upload_raw_dir = original_raw_dir
        settings.upload_quarantine_dir = original_quarantine_dir
        settings.pii_sanitizer_script = original_script
        get_table_schemas.cache_clear()


def test_upload_xlsx_is_converted_and_sanitized(tmp_path):
    settings = get_settings()
    original_data_dir = settings.data_dir
    original_raw_dir = settings.upload_raw_dir
    original_quarantine_dir = settings.upload_quarantine_dir
    original_script = settings.pii_sanitizer_script

    settings.data_dir = str(tmp_path / "reporting")
    settings.upload_raw_dir = str(tmp_path / "raw")
    settings.upload_quarantine_dir = str(tmp_path / "quarantine")
    settings.pii_sanitizer_script = None
    get_table_schemas.cache_clear()

    try:
        workbook = Workbook()
        worksheet = workbook.active
        worksheet.title = "Export"
        worksheet.append(["patient_name", "phone_number", "record_id", "district", "notes"])
        worksheet.append(["Alice", "+261 34 12 345 67", "real-123", "Ampanihy", "Contact alice@example.org"])
        xlsx_path = tmp_path / "TB Export.xlsx"
        workbook.save(xlsx_path)

        response = client.post(
            "/upload-data",
            files={
                "file": (
                    "TB Export.xlsx",
                    xlsx_path.read_bytes(),
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                )
            },
        )

        assert response.status_code == 200
        payload = response.json()
        assert payload["table_name"] == "uploaded_tb_export"
        assert payload["sanitized_filename"] == "uploaded_tb_export.csv"
        assert payload["removed_columns"] == ["patient_name", "phone_number"]
        assert payload["pseudonymized_columns"] == ["record_id"]
        assert payload["redacted_cells"] == 1

        sanitized = Path(settings.data_dir) / "uploaded_tb_export.csv"
        text = sanitized.read_text(encoding="utf-8")
        assert "Alice" not in text
        assert "+261" not in text
        assert "alice@example.org" not in text
        assert "real-123" not in text
        assert "anon_" in text
        assert "[REDACTED]" in text
        assert "Ampanihy" in text
        assert not (Path(settings.upload_raw_dir) / "uploaded_tb_export.converted.csv").exists()
    finally:
        settings.data_dir = original_data_dir
        settings.upload_raw_dir = original_raw_dir
        settings.upload_quarantine_dir = original_quarantine_dir
        settings.pii_sanitizer_script = original_script
        get_table_schemas.cache_clear()


def test_configured_pii_script_is_used_before_builtin_sanitizer(tmp_path):
    source = tmp_path / "source.csv"
    source.write_text(
        "patient_name,phone_number,district\nAlice,+261 34 12 345 67,Ampanihy\n",
        encoding="utf-8",
    )
    script = tmp_path / "remove_pii.py"
    script.write_text(
        "import shutil, sys\nshutil.copyfile(sys.argv[1], sys.argv[2])\n",
        encoding="utf-8",
    )

    output = tmp_path / "sanitized.csv"
    report = sanitize_uploaded_csv(
        source,
        output,
        original_filename="source.csv",
        script_path=str(script),
    )

    assert report.external_script_used is True
    assert report.removed_columns == ["patient_name", "phone_number"]
    assert "Alice" not in output.read_text(encoding="utf-8")
