locals {
  log_group_name = "/ecs/${var.project_name}"
  task_policy_statements = concat(
    [
      {
        Sid    = "ReportsBucketAccess"
        Effect = "Allow"
        Action = [
          "s3:PutObject",
          "s3:GetObject",
        ]
        Resource = "${aws_s3_bucket.reports.arn}/*"
      },
    ],
    local.database_url_secret_arn != null || local.lovable_api_key_secret_arn != null || local.openai_api_key_secret_arn != null ? [
      {
        Sid    = "ReadSecrets"
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue",
        ]
        Resource = compact([
          local.database_url_secret_arn,
          local.lovable_api_key_secret_arn,
          local.openai_api_key_secret_arn,
        ])
      }
    ] : [],
  )
  common_tags = merge(
    {
      Project     = var.project_name
      ManagedBy   = "terraform"
      Environment = "hackathon"
    },
    var.tags,
  )
}

resource "aws_ecr_repository" "app" {
  name                 = var.ecr_repository_name
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  force_delete = true
  tags         = local.common_tags
}

resource "aws_s3_bucket" "reports" {
  bucket_prefix = "${var.project_name}-reports-"
  force_destroy = true
  tags          = local.common_tags
}

resource "aws_s3_bucket_public_access_block" "reports" {
  bucket                  = aws_s3_bucket.reports.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_cloudwatch_log_group" "app" {
  name              = local.log_group_name
  retention_in_days = 7
  tags              = local.common_tags
}

resource "aws_iam_role" "ecs_execution" {
  name = "${var.project_name}-ecs-execution-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
        Action = "sts:AssumeRole"
      }
    ]
  })

  tags = local.common_tags
}

resource "aws_iam_role_policy_attachment" "ecs_execution_managed" {
  role       = aws_iam_role.ecs_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_role" "ecs_task" {
  name = "${var.project_name}-ecs-task-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
        Action = "sts:AssumeRole"
      }
    ]
  })

  tags = local.common_tags
}

resource "aws_secretsmanager_secret" "db_url" {
  count                   = var.db_secret_arn == null && var.create_db_secret_placeholder ? 1 : 0
  name                    = "${var.project_name}/database-url"
  recovery_window_in_days = 0
  tags                    = local.common_tags
}

resource "aws_secretsmanager_secret_version" "db_url_placeholder" {
  count         = var.db_secret_arn == null && var.create_db_secret_placeholder ? 1 : 0
  secret_id     = aws_secretsmanager_secret.db_url[0].id
  secret_string = "REPLACE_ME"
}

resource "aws_secretsmanager_secret" "lovable_api_key" {
  count                   = var.lovable_api_key_secret_arn == null && var.create_lovable_api_key_secret_placeholder ? 1 : 0
  name                    = "${var.project_name}/lovable-api-key"
  recovery_window_in_days = 0
  tags                    = local.common_tags
}

resource "aws_secretsmanager_secret_version" "lovable_api_key_placeholder" {
  count         = var.lovable_api_key_secret_arn == null && var.create_lovable_api_key_secret_placeholder ? 1 : 0
  secret_id     = aws_secretsmanager_secret.lovable_api_key[0].id
  secret_string = "REPLACE_ME"
}

resource "aws_secretsmanager_secret" "openai_api_key" {
  count                   = var.openai_api_key_secret_arn == null && var.create_openai_api_key_secret_placeholder ? 1 : 0
  name                    = "${var.project_name}/openai-api-key"
  recovery_window_in_days = 0
  tags                    = local.common_tags
}

resource "aws_secretsmanager_secret_version" "openai_api_key_placeholder" {
  count         = var.openai_api_key_secret_arn == null && var.create_openai_api_key_secret_placeholder ? 1 : 0
  secret_id     = aws_secretsmanager_secret.openai_api_key[0].id
  secret_string = "REPLACE_ME"
}

locals {
  database_url_secret_arn    = var.db_secret_arn != null ? var.db_secret_arn : try(aws_secretsmanager_secret.db_url[0].arn, null)
  lovable_api_key_secret_arn = var.lovable_api_key_secret_arn != null ? var.lovable_api_key_secret_arn : try(aws_secretsmanager_secret.lovable_api_key[0].arn, null)
  openai_api_key_secret_arn  = var.openai_api_key_secret_arn != null ? var.openai_api_key_secret_arn : try(aws_secretsmanager_secret.openai_api_key[0].arn, null)
}

resource "aws_iam_role_policy" "ecs_task" {
  name = "${var.project_name}-ecs-task-policy"
  role = aws_iam_role.ecs_task.id

  policy = jsonencode({
    Version   = "2012-10-17"
    Statement = local.task_policy_statements
  })
}

resource "aws_security_group" "alb" {
  name_prefix = "${var.project_name}-alb-"
  description = "ALB ingress for ${var.project_name}"
  vpc_id      = var.vpc_id

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = var.allowed_ingress_cidr_blocks
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = local.common_tags
}

resource "aws_security_group" "ecs_service" {
  name_prefix = "${var.project_name}-ecs-"
  description = "ECS service ingress from ALB"
  vpc_id      = var.vpc_id

  ingress {
    from_port       = var.container_port
    to_port         = var.container_port
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = local.common_tags
}

resource "aws_lb" "app" {
  name               = substr(var.project_name, 0, 32)
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = var.public_subnet_ids

  tags = local.common_tags
}

resource "aws_lb_target_group" "app" {
  name_prefix = "hd-"
  port        = var.container_port
  protocol    = "HTTP"
  target_type = "ip"
  vpc_id      = var.vpc_id

  health_check {
    enabled             = true
    path                = "/health"
    healthy_threshold   = 2
    unhealthy_threshold = 5
    interval            = 30
    matcher             = "200"
  }

  tags = local.common_tags
}

resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.app.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.app.arn
  }
}

resource "aws_ecs_cluster" "app" {
  name = var.ecs_cluster_name
  tags = local.common_tags
}
