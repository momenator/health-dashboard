# Terraform

Minimal hackathon Terraform for the backend AWS infrastructure.

This stack intentionally:

- reuses an existing VPC and subnets
- creates ECR, ECS cluster support resources, ALB, security groups, IAM roles, S3, and optional secret placeholders
- leaves ECS task definition, ECS service rollout, image build, and image push to `scripts/deploy.sh`

## Files

- `providers.tf`
- `variables.tf`
- `main.tf`
- `outputs.tf`
- `terraform.tfvars.example`

## Usage

1. Copy the variables file:

   ```bash
   cp terraform.tfvars.example terraform.tfvars
   ```

2. Fill in the existing VPC and subnet IDs.
   - `public_subnet_ids` are for the ALB
   - `ecs_subnet_ids` are for ECS tasks
   - for the simplified hackathon setup, use public subnets for both

3. Initialize and apply:

   ```bash
   terraform init
   terraform apply
   ```

4. Generate `.env.deploy` from the Terraform outputs:

   ```bash
   cd ../..
   ./scripts/render-deploy-env.sh
   ```

5. Fill in the remaining manual values in `.env.deploy`:
   - `AWS_ACCOUNT_ID`
   - `ALLOWED_ORIGINS`
   - optionally `LOVABLE_WEBHOOK_URL`
   - optionally `DATABASE_URL` if you are not using the generated secret ARN
   - or leave both database fields empty to use local SQLite for a demo

`scripts/deploy.sh` can read Terraform outputs directly as a fallback, so `.env.deploy` only needs to hold the values that are still intentionally manual.

Useful outputs for `.env.deploy`:

- `ecr_repository_name`
- `ecs_cluster_name`
- `ecs_service_name`
- `ecs_task_family`
- `ecs_container_name`
- `ecs_container_port`
- `ecs_subnet_ids`
- `ecs_execution_role_arn`
- `ecs_task_role_arn`
- `ecs_security_group_id`
- `target_group_arn`
- `alb_dns_name`
- `reports_bucket_name`
- `database_url_secret_arn`

## Important

- Terraform owns infrastructure only.
- `scripts/deploy.sh` owns ECS task-definition registration and service rollout.
- This stack is optimized for speed, not isolation. It uses public subnets for the ALB and can also use public subnets for ECS tasks with public IPs.
- If you skip Postgres entirely, the deployed app falls back to SQLite in the container filesystem. That is fine for a single-instance hackathon demo and not appropriate for durable production data.
