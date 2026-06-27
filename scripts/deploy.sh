#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"
TERRAFORM_DIR="${ROOT_DIR}/infra/terraform"

if [[ -f ".env.deploy" ]]; then
  set -a
  # shellcheck disable=SC1091
  source ".env.deploy"
  set +a
fi

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

require_env() {
  local name="$1"
  if [[ -z "${!name:-}" ]]; then
    echo "Missing required environment variable: $name" >&2
    exit 1
  fi
}

terraform_output() {
  local key="$1"
  if [[ ! -d "${TERRAFORM_DIR}" ]]; then
    return 1
  fi

  terraform -chdir="${TERRAFORM_DIR}" output -raw "${key}" 2>/dev/null
}

fill_from_terraform() {
  local env_name="$1"
  local output_name="$2"
  if [[ -n "${!env_name:-}" ]]; then
    return 0
  fi

  local value=""
  value="$(terraform_output "${output_name}" || true)"
  if [[ -n "${value}" ]]; then
    printf -v "${env_name}" "%s" "${value}"
    export "${env_name}"
  fi
}

require_command aws
require_command uv
require_command python3
require_command terraform

AWS_REGION="${AWS_REGION:-}"
CONTAINER_CLI="${CONTAINER_CLI:-docker}"
ECR_REPOSITORY="${ECR_REPOSITORY:-health-dashboard-backend}"
ECS_CLUSTER_NAME="${ECS_CLUSTER_NAME:-health-dashboard-cluster}"
ECS_SERVICE_NAME="${ECS_SERVICE_NAME:-health-dashboard-service}"
ECS_TASK_FAMILY="${ECS_TASK_FAMILY:-health-dashboard-task}"
ECS_CONTAINER_NAME="${ECS_CONTAINER_NAME:-health-dashboard-api}"
ECS_CONTAINER_PORT="${ECS_CONTAINER_PORT:-8000}"
ECS_CPU="${ECS_CPU:-1024}"
ECS_MEMORY="${ECS_MEMORY:-2048}"
ECS_DESIRED_COUNT="${ECS_DESIRED_COUNT:-1}"
ECS_LOG_GROUP="${ECS_LOG_GROUP:-/ecs/health-dashboard}"
ECS_LOG_STREAM_PREFIX="${ECS_LOG_STREAM_PREFIX:-ecs}"
ECS_ASSIGN_PUBLIC_IP="${ECS_ASSIGN_PUBLIC_IP:-ENABLED}"
APP_ENV="${APP_ENV:-production}"
ENABLE_BEDROCK="${ENABLE_BEDROCK:-true}"
BEDROCK_MODEL_ID="${BEDROCK_MODEL_ID:-anthropic.claude-3-5-sonnet-20241022-v2:0}"
REPORT_STORAGE_BACKEND="${REPORT_STORAGE_BACKEND:-s3}"
S3_REPORTS_PREFIX="${S3_REPORTS_PREFIX:-reports}"

require_command "${CONTAINER_CLI}"

fill_from_terraform AWS_REGION aws_region
fill_from_terraform ECR_REPOSITORY ecr_repository_name
fill_from_terraform ECS_CLUSTER_NAME ecs_cluster_name
fill_from_terraform ECS_SERVICE_NAME ecs_service_name
fill_from_terraform ECS_TASK_FAMILY ecs_task_family
fill_from_terraform ECS_CONTAINER_NAME ecs_container_name
fill_from_terraform ECS_CONTAINER_PORT ecs_container_port
fill_from_terraform ECS_LOG_GROUP cloudwatch_log_group_name
fill_from_terraform ECS_SECURITY_GROUP_IDS ecs_security_group_id
fill_from_terraform ECS_TARGET_GROUP_ARN target_group_arn
fill_from_terraform ECS_ALB_DNS_NAME alb_dns_name
fill_from_terraform ECS_EXECUTION_ROLE_ARN ecs_execution_role_arn
fill_from_terraform ECS_TASK_ROLE_ARN ecs_task_role_arn
fill_from_terraform S3_REPORTS_BUCKET reports_bucket_name
if [[ -z "${DATABASE_URL:-}" ]]; then
  fill_from_terraform DATABASE_URL_SECRET_ARN database_url_secret_arn
fi
fill_from_terraform LOVABLE_API_KEY_SECRET_ARN lovable_api_key_secret_arn

require_env AWS_REGION
require_env ECS_SUBNET_IDS
require_env ECS_SECURITY_GROUP_IDS
require_env ECS_EXECUTION_ROLE_ARN
require_env ECS_TASK_ROLE_ARN
require_env ALLOWED_ORIGINS
require_env REPORT_STORAGE_BACKEND

if [[ "${REPORT_STORAGE_BACKEND}" == "s3" ]]; then
  require_env S3_REPORTS_BUCKET
fi

if [[ -z "${DATABASE_URL:-}" && -z "${DATABASE_URL_SECRET_ARN:-}" ]]; then
  DATABASE_URL="sqlite:////tmp/health_dashboard.db"
  export DATABASE_URL
fi

AWS_ACCOUNT_ID="${AWS_ACCOUNT_ID:-$(aws sts get-caller-identity --query Account --output text)}"
IMAGE_TAG="${IMAGE_TAG:-$(git rev-parse --short HEAD 2>/dev/null || date +%Y%m%d%H%M%S)-$(date +%s)}"
ECR_REGISTRY="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"
IMAGE_URI="${ECR_REGISTRY}/${ECR_REPOSITORY}:${IMAGE_TAG}"

export AWS_REGION APP_ENV ENABLE_BEDROCK BEDROCK_MODEL_ID REPORT_STORAGE_BACKEND
export S3_REPORTS_PREFIX ALLOWED_ORIGINS DATABASE_URL DATABASE_URL_SECRET_ARN
export S3_REPORTS_BUCKET LOVABLE_WEBHOOK_URL LOVABLE_API_KEY_SECRET_ARN
export ECS_CLUSTER_NAME ECS_SERVICE_NAME ECS_TASK_FAMILY ECS_CONTAINER_NAME ECS_CONTAINER_PORT
export ECS_CPU ECS_MEMORY ECS_DESIRED_COUNT ECS_LOG_GROUP ECS_LOG_STREAM_PREFIX
export ECS_ASSIGN_PUBLIC_IP ECS_SUBNET_IDS ECS_SECURITY_GROUP_IDS ECS_TARGET_GROUP_ARN
export ECS_HEALTHCHECK_GRACE_PERIOD_SECONDS ECS_EXECUTION_ROLE_ARN ECS_TASK_ROLE_ARN
export IMAGE_URI

echo "Running tests"
UV_CACHE_DIR=.uv-cache uv run pytest -q

echo "Ensuring ECR repository exists"
if ! aws ecr describe-repositories --region "${AWS_REGION}" --repository-names "${ECR_REPOSITORY}" >/dev/null 2>&1; then
  aws ecr create-repository --region "${AWS_REGION}" --repository-name "${ECR_REPOSITORY}" >/dev/null
fi

echo "Logging into ECR"
aws ecr get-login-password --region "${AWS_REGION}" | "${CONTAINER_CLI}" login --username AWS --password-stdin "${ECR_REGISTRY}"

echo "Building image ${IMAGE_URI}"
"${CONTAINER_CLI}" build -t "${IMAGE_URI}" .

echo "Pushing image ${IMAGE_URI}"
"${CONTAINER_CLI}" push "${IMAGE_URI}"

echo "Ensuring ECS cluster exists"
if ! aws ecs describe-clusters --region "${AWS_REGION}" --clusters "${ECS_CLUSTER_NAME}" --query "clusters[0].clusterArn" --output text 2>/dev/null | grep -q "arn:"; then
  aws ecs create-cluster --region "${AWS_REGION}" --cluster-name "${ECS_CLUSTER_NAME}" >/dev/null
fi

echo "Ensuring CloudWatch log group exists"
aws logs create-log-group --region "${AWS_REGION}" --log-group-name "${ECS_LOG_GROUP}" >/dev/null 2>&1 || true

TASKDEF_FILE="$(mktemp)"
CREATE_SERVICE_FILE="$(mktemp)"

python3 - "$TASKDEF_FILE" "$CREATE_SERVICE_FILE" <<'PY'
import json
import os
import sys

taskdef_path = sys.argv[1]
service_path = sys.argv[2]

subnets = [item.strip() for item in os.environ["ECS_SUBNET_IDS"].split(",") if item.strip()]
security_groups = [item.strip() for item in os.environ["ECS_SECURITY_GROUP_IDS"].split(",") if item.strip()]

env_vars = [
    {"name": "APP_ENV", "value": os.environ["APP_ENV"]},
    {"name": "APP_DEBUG", "value": "false"},
    {"name": "APP_PORT", "value": os.environ["ECS_CONTAINER_PORT"]},
    {"name": "AWS_REGION", "value": os.environ["AWS_REGION"]},
    {"name": "ALLOWED_ORIGINS", "value": os.environ["ALLOWED_ORIGINS"]},
    {"name": "ENABLE_BEDROCK", "value": os.environ["ENABLE_BEDROCK"]},
    {"name": "BEDROCK_MODEL_ID", "value": os.environ["BEDROCK_MODEL_ID"]},
    {"name": "REPORT_STORAGE_BACKEND", "value": os.environ["REPORT_STORAGE_BACKEND"]},
    {"name": "S3_REPORTS_PREFIX", "value": os.environ.get("S3_REPORTS_PREFIX", "reports")},
]

for key in ["S3_REPORTS_BUCKET", "LOVABLE_WEBHOOK_URL", "DATABASE_URL"]:
    value = os.environ.get(key)
    if value:
        env_vars.append({"name": key, "value": value})

secrets = []
for key in ["DATABASE_URL_SECRET_ARN", "LOVABLE_API_KEY_SECRET_ARN"]:
    value = os.environ.get(key)
    if value:
        target_name = key.removesuffix("_SECRET_ARN")
        secrets.append({"name": target_name, "valueFrom": value})

task_definition = {
    "family": os.environ["ECS_TASK_FAMILY"],
    "networkMode": "awsvpc",
    "requiresCompatibilities": ["FARGATE"],
    "cpu": os.environ["ECS_CPU"],
    "memory": os.environ["ECS_MEMORY"],
    "executionRoleArn": os.environ["ECS_EXECUTION_ROLE_ARN"],
    "taskRoleArn": os.environ["ECS_TASK_ROLE_ARN"],
    "containerDefinitions": [
        {
            "name": os.environ["ECS_CONTAINER_NAME"],
            "image": os.environ["IMAGE_URI"],
            "essential": True,
            "portMappings": [
                {
                    "containerPort": int(os.environ["ECS_CONTAINER_PORT"]),
                    "protocol": "tcp",
                }
            ],
            "environment": env_vars,
            "secrets": secrets,
            "logConfiguration": {
                "logDriver": "awslogs",
                "options": {
                    "awslogs-group": os.environ["ECS_LOG_GROUP"],
                    "awslogs-region": os.environ["AWS_REGION"],
                    "awslogs-stream-prefix": os.environ.get("ECS_LOG_STREAM_PREFIX", "ecs"),
                },
            },
        }
    ],
}

create_service = {
    "cluster": os.environ["ECS_CLUSTER_NAME"],
    "serviceName": os.environ["ECS_SERVICE_NAME"],
    "taskDefinition": os.environ["ECS_TASK_FAMILY"],
    "desiredCount": int(os.environ["ECS_DESIRED_COUNT"]),
    "launchType": "FARGATE",
    "networkConfiguration": {
        "awsvpcConfiguration": {
            "subnets": subnets,
            "securityGroups": security_groups,
            "assignPublicIp": os.environ.get("ECS_ASSIGN_PUBLIC_IP", "DISABLED"),
        }
    },
}

target_group_arn = os.environ.get("ECS_TARGET_GROUP_ARN")
if target_group_arn:
    create_service["loadBalancers"] = [
        {
            "targetGroupArn": target_group_arn,
            "containerName": os.environ["ECS_CONTAINER_NAME"],
            "containerPort": int(os.environ["ECS_CONTAINER_PORT"]),
        }
    ]
    grace_period = os.environ.get("ECS_HEALTHCHECK_GRACE_PERIOD_SECONDS")
    if grace_period:
        create_service["healthCheckGracePeriodSeconds"] = int(grace_period)

with open(taskdef_path, "w", encoding="utf-8") as handle:
    json.dump(task_definition, handle)

with open(service_path, "w", encoding="utf-8") as handle:
    json.dump(create_service, handle)
PY

echo "Registering new task definition"
TASK_DEFINITION_ARN="$(
  aws ecs register-task-definition \
    --region "${AWS_REGION}" \
    --cli-input-json "file://${TASKDEF_FILE}" \
    --query "taskDefinition.taskDefinitionArn" \
    --output text
)"

SERVICE_ARN="$(
  aws ecs describe-services \
    --region "${AWS_REGION}" \
    --cluster "${ECS_CLUSTER_NAME}" \
    --services "${ECS_SERVICE_NAME}" \
    --query "services[0].serviceArn" \
    --output text 2>/dev/null || true
)"

if [[ -n "${SERVICE_ARN}" && "${SERVICE_ARN}" != "None" ]]; then
  echo "Updating ECS service ${ECS_SERVICE_NAME}"
  aws ecs update-service \
    --region "${AWS_REGION}" \
    --cluster "${ECS_CLUSTER_NAME}" \
    --service "${ECS_SERVICE_NAME}" \
    --task-definition "${TASK_DEFINITION_ARN}" \
    --desired-count "${ECS_DESIRED_COUNT}" \
    --force-new-deployment >/dev/null
else
  echo "Creating ECS service ${ECS_SERVICE_NAME}"
  python3 - "$CREATE_SERVICE_FILE" "$TASK_DEFINITION_ARN" <<'PY'
import json
import sys

service_path = sys.argv[1]
task_definition_arn = sys.argv[2]

with open(service_path, "r", encoding="utf-8") as handle:
    payload = json.load(handle)

payload["taskDefinition"] = task_definition_arn

with open(service_path, "w", encoding="utf-8") as handle:
    json.dump(payload, handle)
PY
  aws ecs create-service \
    --region "${AWS_REGION}" \
    --cli-input-json "file://${CREATE_SERVICE_FILE}" >/dev/null
fi

rm -f "${TASKDEF_FILE}" "${CREATE_SERVICE_FILE}"

echo "Waiting for ECS service to become stable"
aws ecs wait services-stable \
  --region "${AWS_REGION}" \
  --cluster "${ECS_CLUSTER_NAME}" \
  --services "${ECS_SERVICE_NAME}"

echo "Deployment complete"
echo "Cluster: ${ECS_CLUSTER_NAME}"
echo "Service: ${ECS_SERVICE_NAME}"
echo "Task definition: ${TASK_DEFINITION_ARN}"
if [[ -n "${ECS_ALB_DNS_NAME:-}" ]]; then
  echo "Service URL: https://${ECS_ALB_DNS_NAME}"
else
  echo "No ALB DNS name configured. Set ECS_ALB_DNS_NAME in .env.deploy to print a stable public URL."
fi
