variable "project_name" {
  description = "Short project name used in resource naming."
  type        = string
  default     = "health-dashboard"
}

variable "aws_region" {
  description = "AWS region for resources."
  type        = string
  default     = "eu-central-1"
}

variable "vpc_id" {
  description = "Existing VPC ID to deploy into."
  type        = string
}

variable "public_subnet_ids" {
  description = "Public subnet IDs for the ALB."
  type        = list(string)
}

variable "ecs_subnet_ids" {
  description = "Subnet IDs for ECS tasks. For hackathon speed, use public subnets."
  type        = list(string)
}

variable "allowed_ingress_cidr_blocks" {
  description = "CIDR blocks allowed to reach the ALB."
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

variable "container_port" {
  description = "Application container port."
  type        = number
  default     = 8000
}

variable "ecr_repository_name" {
  description = "ECR repository name."
  type        = string
  default     = "health-dashboard-backend"
}

variable "ecs_cluster_name" {
  description = "ECS cluster name."
  type        = string
  default     = "health-dashboard-cluster"
}

variable "ecs_service_name" {
  description = "ECS service name used by the deploy script."
  type        = string
  default     = "health-dashboard-service"
}

variable "ecs_task_family" {
  description = "ECS task family used by the deploy script."
  type        = string
  default     = "health-dashboard-task"
}

variable "ecs_container_name" {
  description = "ECS container name used by the deploy script."
  type        = string
  default     = "health-dashboard-api"
}

variable "ecs_cpu" {
  description = "Fargate CPU units."
  type        = number
  default     = 1024
}

variable "ecs_memory" {
  description = "Fargate memory in MiB."
  type        = number
  default     = 2048
}

variable "desired_count" {
  description = "Desired ECS task count."
  type        = number
  default     = 1
}

variable "allowed_origins" {
  description = "CORS origins for the frontend."
  type        = list(string)
}

variable "lovable_webhook_url" {
  description = "Optional Lovable callback URL."
  type        = string
  default     = null
}

variable "create_db_secret_placeholder" {
  description = "Create an empty Secrets Manager secret placeholder for DATABASE_URL."
  type        = bool
  default     = true
}

variable "db_secret_arn" {
  description = "Existing DATABASE_URL secret ARN. If null and placeholder is enabled, Terraform creates one."
  type        = string
  default     = null
}

variable "create_lovable_api_key_secret_placeholder" {
  description = "Create an empty Secrets Manager secret placeholder for LOVABLE_API_KEY."
  type        = bool
  default     = false
}

variable "lovable_api_key_secret_arn" {
  description = "Existing LOVABLE_API_KEY secret ARN."
  type        = string
  default     = null
}

variable "create_openai_api_key_secret_placeholder" {
  description = "Create an empty Secrets Manager secret placeholder for OPENAI_API_KEY."
  type        = bool
  default     = true
}

variable "openai_api_key_secret_arn" {
  description = "Existing OPENAI_API_KEY secret ARN."
  type        = string
  default     = null
}

variable "tags" {
  description = "Common tags to apply."
  type        = map(string)
  default     = {}
}
