# Health Dashboard Backend

Python backend for a hackathon health dashboard. It exposes APIs for:

- storing health records
- generating AI-assisted reports
- serving report PDFs
- notifying a Lovable frontend instance when reports are ready

## Stack

- FastAPI
- SQLAlchemy
- SQLite for local development
- AWS Bedrock for report generation
- Local file storage or S3 for generated reports

## Quick start

1. Create the environment and install dependencies with `uv`:

   ```bash
   uv sync --extra dev
   ```

2. Copy the environment file:

   ```bash
   cp .env.example .env
   ```

3. Start the API:

   ```bash
   uv run uvicorn app.main:app --reload
   ```

4. Open `http://127.0.0.1:8000/docs`.

## Deploy to AWS

This repo now includes a single production deploy script for ECS on Fargate:

```bash
cp .env.deploy.example .env.deploy
# fill in the AWS values
./scripts/deploy.sh
```

The script:

- runs tests with `uv`
- builds the Docker image locally
- pushes it to ECR
- registers a new ECS task definition
- creates or updates one ECS Fargate service

See `docs/aws-setup.md` for the AWS resources you need first.

## Terraform

A minimal hackathon Terraform stack is included in `infra/terraform/`.

It provisions:

- ECR
- ECS cluster support resources
- ALB and target group
- security groups
- ECS IAM roles
- S3 bucket for reports
- optional Secrets Manager placeholders

Typical flow:

```bash
cd infra/terraform
cp terraform.tfvars.example terraform.tfvars
terraform init
terraform apply
```

Then copy the Terraform outputs into `.env.deploy` and run:

```bash
./scripts/render-deploy-env.sh
# fill in any remaining values like ALLOWED_ORIGINS
./scripts/deploy.sh
```

`deploy.sh` can also read Terraform-managed values directly from `infra/terraform` when `.env.deploy` is missing or incomplete. The remaining explicit values are the environment-specific ones Terraform does not infer for you, primarily `ALLOWED_ORIGINS`.

For a quick demo, you can leave both `DATABASE_URL` and `DATABASE_URL_SECRET_ARN` empty. The deployed app will fall back to SQLite inside the ECS task.

## API overview

- `GET /health`
- `POST /api/v1/health-records`
- `GET /api/v1/health-records`
- `GET /api/v1/health-records/{record_id}`
- `POST /api/v1/reports/generate`
- `GET /api/v1/reports`
- `GET /api/v1/reports/{report_id}`
- `GET /api/v1/reports/{report_id}/download`

## Local development notes

- With `ENABLE_BEDROCK=false`, the app generates a deterministic local summary so you can develop without AWS credentials.
- Set `ALLOWED_ORIGINS` to the Lovable preview URL once you have it.
- Generated PDFs are written to `data/reports/` by default.
- `uv sync` creates and manages `.venv` automatically.

## AWS deployment notes

You need these AWS pieces:

1. An IAM role or user with:
   - `bedrock:InvokeModel`
   - `bedrock:InvokeModelWithResponseStream` if you later stream responses
   - `s3:PutObject`, `s3:GetObject` if storing reports in S3
2. Bedrock model access enabled in the target region.
3. A deployment target such as ECS Fargate, Lambda, or EC2.
4. Optionally RDS Postgres instead of SQLite for production.
5. Optionally Secrets Manager or SSM Parameter Store for app secrets.

More detail is in `docs/aws-setup.md`.
