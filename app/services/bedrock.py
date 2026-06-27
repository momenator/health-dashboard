import json

import boto3

from app.core.config import Settings
from app.models import HealthRecord


class BedrockReportService:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    def generate_report(self, record: HealthRecord) -> dict:
        if not self.settings.enable_bedrock:
            return self._fallback_report(record)

        session = boto3.session.Session(
            aws_access_key_id=self.settings.aws_access_key_id,
            aws_secret_access_key=self.settings.aws_secret_access_key,
            aws_session_token=self.settings.aws_session_token,
            region_name=self.settings.aws_region,
        )
        client = session.client("bedrock-runtime")

        prompt = self._build_prompt(record)
        response = client.converse(
            modelId=self.settings.bedrock_model_id,
            system=[{"text": "You are a clinical reporting assistant. Keep output concise and structured."}],
            messages=[{"role": "user", "content": [{"text": prompt}]}],
            inferenceConfig={"temperature": 0.2, "maxTokens": 700},
        )

        text_blocks = response["output"]["message"]["content"]
        text = "\n".join(block.get("text", "") for block in text_blocks if "text" in block).strip()

        try:
            parsed = json.loads(text)
        except json.JSONDecodeError:
            parsed = {
                "risk_level": "medium",
                "summary": text,
                "recommendations": [
                    "Review the generated narrative before clinical use.",
                    "Confirm abnormal readings with a licensed professional.",
                ],
            }

        parsed["model_name"] = self.settings.bedrock_model_id
        return parsed

    def _build_prompt(self, record: HealthRecord) -> str:
        return f"""
Create a JSON object with keys: risk_level, summary, recommendations.
Recommendations must be an array of short strings.

Patient:
- patient_id: {record.patient_id}
- patient_name: {record.patient_name}
- age: {record.age}
- gender: {record.gender}
- heart_rate: {record.heart_rate}
- systolic_bp: {record.systolic_bp}
- diastolic_bp: {record.diastolic_bp}
- blood_glucose: {record.blood_glucose}
- spo2: {record.spo2}
- weight_kg: {record.weight_kg}
- height_cm: {record.height_cm}
- notes: {record.notes}
""".strip()

    def _fallback_report(self, record: HealthRecord) -> dict:
        issues: list[str] = []
        risk_level = "low"

        if record.systolic_bp and record.systolic_bp >= 140:
            issues.append("Elevated systolic blood pressure")
            risk_level = "medium"
        if record.blood_glucose and record.blood_glucose >= 180:
            issues.append("High blood glucose reading")
            risk_level = "medium"
        if record.spo2 and record.spo2 < 94:
            issues.append("Lower-than-expected oxygen saturation")
            risk_level = "high"

        summary = (
            f"{record.patient_name} has {len(issues)} flagged findings."
            if issues
            else f"{record.patient_name} has no major flagged findings in the submitted metrics."
        )

        recommendations = [
            "Review trend data alongside this single reading.",
            "Route abnormal values to a clinician for validation.",
        ]
        if issues:
            recommendations.insert(0, "Prioritize follow-up on the flagged findings.")

        return {
            "risk_level": risk_level,
            "summary": f"{summary} Findings: {', '.join(issues) if issues else 'none'}.",
            "recommendations": recommendations,
            "model_name": "local-fallback",
        }
