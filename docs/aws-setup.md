# AWS Setup Guide

This backend is designed so you can start locally and move to AWS without changing application code.

## 1. Bedrock prerequisites

You need all of the following in the AWS account and region you plan to use:

- AWS Bedrock available in that region
- model access enabled for the model in `BEDROCK_MODEL_ID`
- IAM permission to call the model

Minimum IAM actions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "bedrock:InvokeModel",
        "bedrock:InvokeModelWithResponseStream"
      ],
      "Resource": "*"
    }
  ]
}
```

If you want to lock this down further, scope `Resource` to the model ARN once you finalize the exact model and region.

## 2. Storage choice

For the hackathon, use one of these:

1. `local` storage for reports:
   - simplest for local development
   - not suitable for horizontally scaled production
2. `s3` storage for reports:
   - recommended for AWS deployment
   - works well with ECS

Extra IAM for S3:

```json
{
  "Effect": "Allow",
  "Action": [
    "s3:PutObject",
    "s3:GetObject"
  ],
  "Resource": [
    "arn:aws:s3:::YOUR_REPORT_BUCKET/*"
  ]
}
```

## 3. Database choice

Current default is SQLite:

- good for local development
- acceptable for a demo if only one instance writes to disk
- not appropriate for real multi-instance production

For AWS, use Postgres on RDS or Aurora and set:

```bash
DATABASE_URL=postgresql+psycopg://USER:PASSWORD@HOST:5432/DBNAME
```

This codebase is already env-driven, so the main remaining work is adding the Postgres driver dependency before deployment.

For a hackathon shortcut, you can skip Postgres entirely and let the app run with SQLite in the container filesystem. That is acceptable only for a single-instance demo where you do not care about persistence across task replacement.

For the simplest networking path, run ECS tasks in public subnets with `assignPublicIp=ENABLED`. That avoids private-subnet NAT setup.

## 4. Deployment target

Practical options:

1. ECS Fargate
   - standard container deployment path on AWS
   - good fit for this backend
2. Lambda + API Gateway
   - fine, but more moving parts for file generation and binary responses

For this repo, choose ECS Fargate.

## 4a. Simple production deployment from your laptop

This repo includes `scripts/deploy.sh`.

If you want reproducible infrastructure instead of manual AWS setup, use the Terraform stack in `infra/terraform/` first and then use `scripts/deploy.sh` for application rollouts.

Deployment flow:

1. Run tests locally with `uv`
2. Build the container image locally
3. Push the image to ECR
4. Register a new ECS task definition
5. Create or update one ECS Fargate service

This is intentionally simpler than CI/CD and is a reasonable hackathon tradeoff.

### AWS resources you need before the first deploy

1. One ECR repository
   - the script can create it if it does not exist
2. One VPC with at least two public subnets
3. An internet gateway route on those public subnets
4. Ideally one ALB target group for a stable public URL
5. One ECS task execution role
   - referenced as `ECS_EXECUTION_ROLE_ARN`
   - trust policy is in `docs/iam/ecs-task-execution-trust-policy.json`
   - attach the AWS-managed policy `service-role/AmazonECSTaskExecutionRolePolicy`
6. One ECS task role for application AWS access
   - referenced as `ECS_TASK_ROLE_ARN`
   - this role needs Bedrock and S3 permissions

Policy templates for these roles are in `docs/iam/`.

### First-time setup checklist

1. Copy `.env.deploy.example` to `.env.deploy`
2. Fill in:
   - AWS account ID
   - region
   - ECS role ARNs
   - subnet IDs
   - security group IDs
   - target group ARN if using an ALB
   - allowed frontend origin
   - storage settings
   - database setting or secret ARN
   - values from Terraform outputs if you used `infra/terraform/`
3. Make sure your laptop can run:
   - `aws sts get-caller-identity`
   - `docker ps`
   - `uv run pytest -q`
4. Run:

```bash
chmod +x scripts/deploy.sh
./scripts/deploy.sh
```

### IAM JSON files in this repo

- `docs/iam/ecs-task-execution-trust-policy.json`
- `docs/iam/ecs-task-role-trust-policy.json`
- `docs/iam/ecs-task-role-permissions-policy.json`
- `docs/iam/ecs-deployer-policy.json`

For the execution role permissions, use the AWS-managed policy:

```bash
arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy
```

## 5. Secrets and configuration

At minimum, define:

- `AWS_REGION`
- `ENABLE_BEDROCK=true`
- `BEDROCK_MODEL_ID=...`
- `DATABASE_URL=...`
- `ALLOWED_ORIGINS=https://your-lovable-app-url`
- `LOVABLE_WEBHOOK_URL=https://your-lovable-app-url/api/...` if you want callbacks
- `REPORT_STORAGE_BACKEND=s3`
- `S3_REPORTS_BUCKET=...`

Prefer storing secrets in Secrets Manager or SSM Parameter Store rather than hardcoding them in environment files.

For this script, the practical split is:

- plain env vars in `.env.deploy` for non-sensitive config
- Secrets Manager ARNs for sensitive values such as database URLs or Lovable API keys

## 6. Lovable integration

From the Lovable side, you need:

- the deployed backend base URL
- CORS configured to allow the Lovable origin
- agreed API payloads for record creation and report retrieval

Suggested frontend flow:

1. Lovable app posts health metrics to `POST /api/v1/health-records`
2. Lovable app triggers `POST /api/v1/reports/generate`
3. Lovable app polls `GET /api/v1/reports/{id}` or receives a webhook callback
4. Lovable app opens `GET /api/v1/reports/{id}/download`

## 7. What you still need to decide

- exact Bedrock model
- whether reports should stay as PDFs, JSON summaries, or both
- whether report files live on local disk or S3
- whether production uses Postgres and where it runs
- exact Lovable URL and auth approach
