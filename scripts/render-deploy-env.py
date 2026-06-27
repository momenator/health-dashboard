#!/usr/bin/env python3

from __future__ import annotations

import json
import shlex
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
TERRAFORM_DIR = ROOT / "infra" / "terraform"
DEPLOY_ENV = ROOT / ".env.deploy"


def run_terraform_output() -> dict:
    result = subprocess.run(
        ["terraform", "output", "-json"],
        cwd=TERRAFORM_DIR,
        check=True,
        capture_output=True,
        text=True,
    )
    return json.loads(result.stdout)


def read_existing_env(path: Path) -> dict[str, str]:
    if not path.exists():
        return {}

    values: dict[str, str] = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            continue
        key, value = stripped.split("=", 1)
        values[key] = value
    return values


def get_output(outputs: dict, key: str) -> str:
    if key not in outputs:
        raise KeyError(key)
    value = outputs[key]["value"]
    if isinstance(value, list):
        return ",".join(value)
    return str(value)


def quote(value: str) -> str:
    if value == "":
        return ""
    needs_quotes = any(ch.isspace() for ch in value) or any(ch in value for ch in ['"', "'", "#"])
    return shlex.quote(value) if needs_quotes else value


def main() -> int:
    outputs = run_terraform_output()
    required_output_keys = [
        "aws_region",
        "ecr_repository_name",
        "ecs_cluster_name",
        "ecs_service_name",
        "ecs_task_family",
        "ecs_container_name",
        "ecs_container_port",
        "ecs_subnet_ids",
        "cloudwatch_log_group_name",
        "ecs_security_group_id",
        "target_group_arn",
        "alb_dns_name",
        "ecs_execution_role_arn",
        "ecs_task_role_arn",
        "reports_bucket_name",
        "database_url_secret_arn",
        "lovable_api_key_secret_arn",
    ]
    missing = [key for key in required_output_keys if key not in outputs]
    if missing:
        missing_list = ", ".join(missing)
        raise RuntimeError(
            "Terraform outputs are incomplete. Run 'terraform apply' in infra/terraform first. "
            f"Missing outputs: {missing_list}"
        )

    existing = read_existing_env(DEPLOY_ENV)

    values = {
        "AWS_REGION": get_output(outputs, "aws_region"),
        "ECR_REPOSITORY": get_output(outputs, "ecr_repository_name"),
        "ECS_CLUSTER_NAME": get_output(outputs, "ecs_cluster_name"),
        "ECS_SERVICE_NAME": get_output(outputs, "ecs_service_name"),
        "ECS_TASK_FAMILY": get_output(outputs, "ecs_task_family"),
        "ECS_CONTAINER_NAME": get_output(outputs, "ecs_container_name"),
        "ECS_CONTAINER_PORT": get_output(outputs, "ecs_container_port"),
        "ECS_SUBNET_IDS": get_output(outputs, "ecs_subnet_ids"),
        "ECS_LOG_GROUP": get_output(outputs, "cloudwatch_log_group_name"),
        "ECS_SECURITY_GROUP_IDS": get_output(outputs, "ecs_security_group_id"),
        "ECS_TARGET_GROUP_ARN": get_output(outputs, "target_group_arn"),
        "ECS_ALB_DNS_NAME": get_output(outputs, "alb_dns_name"),
        "ECS_EXECUTION_ROLE_ARN": get_output(outputs, "ecs_execution_role_arn"),
        "ECS_TASK_ROLE_ARN": get_output(outputs, "ecs_task_role_arn"),
        "S3_REPORTS_BUCKET": get_output(outputs, "reports_bucket_name"),
        "DATABASE_URL_SECRET_ARN": get_output(outputs, "database_url_secret_arn"),
        "LOVABLE_API_KEY_SECRET_ARN": get_output(outputs, "lovable_api_key_secret_arn"),
    }

    defaults = {
        "AWS_ACCOUNT_ID": existing.get("AWS_ACCOUNT_ID", ""),
        "ECS_CPU": existing.get("ECS_CPU", "1024"),
        "ECS_MEMORY": existing.get("ECS_MEMORY", "2048"),
        "ECS_DESIRED_COUNT": existing.get("ECS_DESIRED_COUNT", "1"),
        "ECS_LOG_STREAM_PREFIX": existing.get("ECS_LOG_STREAM_PREFIX", "ecs"),
        "ECS_ASSIGN_PUBLIC_IP": existing.get("ECS_ASSIGN_PUBLIC_IP", "ENABLED"),
        "ECS_HEALTHCHECK_GRACE_PERIOD_SECONDS": existing.get("ECS_HEALTHCHECK_GRACE_PERIOD_SECONDS", "60"),
        "APP_ENV": existing.get("APP_ENV", "production"),
        "ALLOWED_ORIGINS": existing.get("ALLOWED_ORIGINS", ""),
        "ENABLE_BEDROCK": existing.get("ENABLE_BEDROCK", "true"),
        "BEDROCK_MODEL_ID": existing.get("BEDROCK_MODEL_ID", "anthropic.claude-3-5-sonnet-20241022-v2:0"),
        "REPORT_STORAGE_BACKEND": existing.get("REPORT_STORAGE_BACKEND", "s3"),
        "S3_REPORTS_PREFIX": existing.get("S3_REPORTS_PREFIX", "reports"),
        "LOVABLE_WEBHOOK_URL": existing.get("LOVABLE_WEBHOOK_URL", ""),
        "DATABASE_URL": existing.get("DATABASE_URL", ""),
    }

    lines = [
        f"AWS_REGION={quote(values['AWS_REGION'])}",
        f"AWS_ACCOUNT_ID={quote(defaults['AWS_ACCOUNT_ID'])}",
        "",
        f"ECR_REPOSITORY={quote(values['ECR_REPOSITORY'])}",
        "",
        f"ECS_CLUSTER_NAME={quote(values['ECS_CLUSTER_NAME'])}",
        f"ECS_SERVICE_NAME={quote(values['ECS_SERVICE_NAME'])}",
        f"ECS_TASK_FAMILY={quote(values['ECS_TASK_FAMILY'])}",
        f"ECS_CONTAINER_NAME={quote(values['ECS_CONTAINER_NAME'])}",
        f"ECS_CONTAINER_PORT={quote(values['ECS_CONTAINER_PORT'])}",
        f"ECS_CPU={quote(defaults['ECS_CPU'])}",
        f"ECS_MEMORY={quote(defaults['ECS_MEMORY'])}",
        f"ECS_DESIRED_COUNT={quote(defaults['ECS_DESIRED_COUNT'])}",
        f"ECS_LOG_GROUP={quote(values['ECS_LOG_GROUP'])}",
        f"ECS_LOG_STREAM_PREFIX={quote(defaults['ECS_LOG_STREAM_PREFIX'])}",
        f"ECS_ASSIGN_PUBLIC_IP={quote(defaults['ECS_ASSIGN_PUBLIC_IP'])}",
        "",
        "# Comma-separated subnet and security group IDs.",
        f"ECS_SUBNET_IDS={quote(values['ECS_SUBNET_IDS'])}",
        f"ECS_SECURITY_GROUP_IDS={quote(values['ECS_SECURITY_GROUP_IDS'])}",
        "",
        "# Generated from Terraform outputs.",
        f"ECS_TARGET_GROUP_ARN={quote(values['ECS_TARGET_GROUP_ARN'])}",
        f"ECS_HEALTHCHECK_GRACE_PERIOD_SECONDS={quote(defaults['ECS_HEALTHCHECK_GRACE_PERIOD_SECONDS'])}",
        f"ECS_ALB_DNS_NAME={quote(values['ECS_ALB_DNS_NAME'])}",
        "",
        "# Generated from Terraform outputs.",
        f"ECS_EXECUTION_ROLE_ARN={quote(values['ECS_EXECUTION_ROLE_ARN'])}",
        f"ECS_TASK_ROLE_ARN={quote(values['ECS_TASK_ROLE_ARN'])}",
        "",
        f"APP_ENV={quote(defaults['APP_ENV'])}",
        f"ALLOWED_ORIGINS={quote(defaults['ALLOWED_ORIGINS'])}",
        f"ENABLE_BEDROCK={quote(defaults['ENABLE_BEDROCK'])}",
        f"BEDROCK_MODEL_ID={quote(defaults['BEDROCK_MODEL_ID'])}",
        "",
        f"REPORT_STORAGE_BACKEND={quote(defaults['REPORT_STORAGE_BACKEND'])}",
        f"S3_REPORTS_BUCKET={quote(values['S3_REPORTS_BUCKET'])}",
        f"S3_REPORTS_PREFIX={quote(defaults['S3_REPORTS_PREFIX'])}",
        "",
        "# Leave both empty to use local SQLite inside the ECS task for a demo.",
        "# Use a plain DATABASE_URL only if you are not using Secrets Manager.",
        f"DATABASE_URL={quote(defaults['DATABASE_URL'])}",
        f"DATABASE_URL_SECRET_ARN={quote(values['DATABASE_URL_SECRET_ARN'])}",
        "",
        "# Optional Lovable callback config.",
        f"LOVABLE_WEBHOOK_URL={quote(defaults['LOVABLE_WEBHOOK_URL'])}",
        f"LOVABLE_API_KEY_SECRET_ARN={quote(values['LOVABLE_API_KEY_SECRET_ARN'])}",
        "",
    ]

    DEPLOY_ENV.write_text("\n".join(lines), encoding="utf-8")
    print(f"Wrote {DEPLOY_ENV}")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except RuntimeError as exc:
        sys.stderr.write(f"{exc}\n")
        raise SystemExit(1)
    except subprocess.CalledProcessError as exc:
        sys.stderr.write(exc.stderr or str(exc))
        raise
