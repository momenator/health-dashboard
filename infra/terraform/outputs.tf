output "aws_region" {
  value = var.aws_region
}

output "ecr_repository_name" {
  value = aws_ecr_repository.app.name
}

output "ecr_repository_url" {
  value = aws_ecr_repository.app.repository_url
}

output "ecs_cluster_name" {
  value = aws_ecs_cluster.app.name
}

output "ecs_service_name" {
  value = var.ecs_service_name
}

output "ecs_task_family" {
  value = var.ecs_task_family
}

output "ecs_container_name" {
  value = var.ecs_container_name
}

output "ecs_container_port" {
  value = var.container_port
}

output "ecs_subnet_ids" {
  value = var.ecs_subnet_ids
}

output "ecs_execution_role_arn" {
  value = aws_iam_role.ecs_execution.arn
}

output "ecs_task_role_arn" {
  value = aws_iam_role.ecs_task.arn
}

output "ecs_security_group_id" {
  value = aws_security_group.ecs_service.id
}

output "alb_dns_name" {
  value = aws_lb.app.dns_name
}

output "alb_security_group_id" {
  value = aws_security_group.alb.id
}

output "target_group_arn" {
  value = aws_lb_target_group.app.arn
}

output "cloudwatch_log_group_name" {
  value = aws_cloudwatch_log_group.app.name
}

output "reports_bucket_name" {
  value = aws_s3_bucket.reports.bucket
}

output "database_url_secret_arn" {
  value = local.database_url_secret_arn
}

output "lovable_api_key_secret_arn" {
  value = local.lovable_api_key_secret_arn
}

output "openai_api_key_secret_arn" {
  value = local.openai_api_key_secret_arn
}
