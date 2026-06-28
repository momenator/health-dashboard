# AWS Setup Guide

This backend can run locally with CSV data and deploy to AWS without changing
application code. Model calls use OpenAI; AWS is used for hosting, optional
Athena/S3 data access, logs, and secrets.

## 1. OpenAI Configuration

Local development uses `.env`:

```bash
ENABLE_OPENAI=true
OPENAI_MODEL=gpt-5.5
OPENAI_API_KEY=sk-your-openai-api-key
```

Do not commit real API keys. For ECS, store `OPENAI_API_KEY` in Secrets Manager
and pass the secret ARN as `OPENAI_API_KEY_SECRET_ARN`.

## 2. Storage Choice

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
  "Action": ["s3:PutObject", "s3:GetObject"],
  "Resource": ["arn:aws:s3:::YOUR_REPORT_BUCKET/*"]
}
```

## 3. Database Choice

Current default is SQLite:

- good for local development
- acceptable for a single-instance demo
- not appropriate for real multi-instance production

For AWS, use Postgres on RDS or Aurora and set:

```bash
DATABASE_URL=postgresql+psycopg://USER:PASSWORD@HOST:5432/DBNAME
```

For a hackathon shortcut, you can skip Postgres and let the app run with SQLite
in the container filesystem. That is acceptable only when persistence across
task replacement does not matter.

## 4. Deployment Target

For this repo, use ECS Fargate.

Deployment flow:

1. Run tests locally with `uv`
2. Build the container image locally
3. Push the image to ECR
4. Register a new ECS task definition
5. Create or update one ECS Fargate service

Use the Terraform stack in `infra/terraform/` first if you want reproducible
infrastructure, then use `scripts/deploy.sh` for application rollouts.

## 5. Required AWS Resources

1. One ECR repository
2. One VPC with at least two public subnets
3. An internet gateway route on those public subnets
4. Ideally one ALB target group for a stable public URL
5. One ECS task execution role with the AWS-managed policy:

```bash
arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy
```

6. One ECS task role for application AWS access:
   - S3 report bucket access, if using S3
   - Secrets Manager access for `OPENAI_API_KEY`, `DATABASE_URL`, or Lovable keys
   - Athena/Glue/S3 data access, if using Athena instead of local CSV

Policy templates for these roles are in `docs/iam/`.

## 6. Secrets And Configuration

At minimum, define:

- `AWS_REGION`
- `ENABLE_OPENAI=true`
- `OPENAI_MODEL=gpt-5.5`
- `OPENAI_API_KEY_SECRET_ARN=...` or local `OPENAI_API_KEY`
- `ALLOWED_ORIGINS=https://your-frontend-url`
- `REPORT_STORAGE_BACKEND=s3`
- `S3_REPORTS_BUCKET=...`

Prefer storing secrets in Secrets Manager rather than hardcoding them in
environment files.

## 7. What You Still Need To Decide

- whether reports should stay as PDFs, JSON summaries, or both
- whether report files live on local disk or S3
- whether production uses Postgres and where it runs
- exact frontend URL and auth approach
