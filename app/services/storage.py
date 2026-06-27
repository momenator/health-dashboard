from pathlib import Path

import boto3

from app.core.config import Settings


class ReportStorageService:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    def save_pdf(self, filename: str, content: bytes) -> str:
        if self.settings.report_storage_backend == "s3":
            return self._save_to_s3(filename, content)
        return self._save_local(filename, content)

    def load_pdf(self, pdf_uri: str) -> bytes:
        if pdf_uri.startswith("s3://"):
            return self._load_from_s3(pdf_uri)
        return Path(pdf_uri).read_bytes()

    def _save_local(self, filename: str, content: bytes) -> str:
        reports_dir = Path(self.settings.reports_dir)
        reports_dir.mkdir(parents=True, exist_ok=True)
        target = reports_dir / filename
        target.write_bytes(content)
        return str(target.resolve())

    def _save_to_s3(self, filename: str, content: bytes) -> str:
        if not self.settings.s3_reports_bucket:
            raise ValueError("S3_REPORTS_BUCKET is required when REPORT_STORAGE_BACKEND=s3")

        session = boto3.session.Session(
            aws_access_key_id=self.settings.aws_access_key_id,
            aws_secret_access_key=self.settings.aws_secret_access_key,
            aws_session_token=self.settings.aws_session_token,
            region_name=self.settings.aws_region,
        )
        s3 = session.client("s3")
        key = f"{self.settings.s3_reports_prefix.rstrip('/')}/{filename}"
        s3.put_object(
            Bucket=self.settings.s3_reports_bucket,
            Key=key,
            Body=content,
            ContentType="application/pdf",
        )
        return f"s3://{self.settings.s3_reports_bucket}/{key}"

    def _load_from_s3(self, pdf_uri: str) -> bytes:
        _, _, remainder = pdf_uri.partition("s3://")
        bucket, _, key = remainder.partition("/")

        session = boto3.session.Session(
            aws_access_key_id=self.settings.aws_access_key_id,
            aws_secret_access_key=self.settings.aws_secret_access_key,
            aws_session_token=self.settings.aws_session_token,
            region_name=self.settings.aws_region,
        )
        s3 = session.client("s3")
        response = s3.get_object(Bucket=bucket, Key=key)
        return response["Body"].read()
