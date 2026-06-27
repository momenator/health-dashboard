# ─────────────────────────────────────────────────────────────────────────────
# API Gateway HTTP API – HTTPS facade in front of the ALB
# ─────────────────────────────────────────────────────────────────────────────
# This gives us a managed HTTPS endpoint (https://xxx.execute-api.<region>.amazonaws.com)
# that proxies all requests to the existing HTTP ALB. No custom domain or
# ACM certificate required.

resource "aws_apigatewayv2_api" "http_api" {
  name          = "${var.project_name}-api"
  protocol_type = "HTTP"

  cors_configuration {
    allow_origins     = var.allowed_origins
    allow_methods     = ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
    allow_headers     = ["Content-Type", "Authorization", "X-Requested-With"]
    expose_headers    = ["*"]
    allow_credentials = true
    max_age           = 3600
  }

  tags = local.common_tags
}

resource "aws_apigatewayv2_integration" "alb" {
  api_id             = aws_apigatewayv2_api.http_api.id
  integration_type   = "HTTP_PROXY"
  integration_method = "ANY"
  integration_uri    = aws_lb_listener.http.arn

  connection_type = "VPC_LINK"
  connection_id   = aws_apigatewayv2_vpc_link.main.id

  payload_format_version = "1.0"
}

resource "aws_apigatewayv2_vpc_link" "main" {
  name               = "${var.project_name}-vpc-link"
  security_group_ids = [aws_security_group.alb.id]
  subnet_ids         = var.public_subnet_ids

  tags = local.common_tags
}

resource "aws_apigatewayv2_route" "catch_all" {
  api_id    = aws_apigatewayv2_api.http_api.id
  route_key = "$default"
  target    = "integrations/${aws_apigatewayv2_integration.alb.id}"
}

resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.http_api.id
  name        = "$default"
  auto_deploy = true

  access_log_settings {
    destination_arn = aws_cloudwatch_log_group.api_gateway.arn
    format = jsonencode({
      requestId      = "$context.requestId"
      ip             = "$context.identity.sourceIp"
      method         = "$context.httpMethod"
      path           = "$context.path"
      status         = "$context.status"
      responseLength = "$context.responseLength"
      latency        = "$context.integrationLatency"
    })
  }

  tags = local.common_tags
}

resource "aws_cloudwatch_log_group" "api_gateway" {
  name              = "/aws/apigateway/${var.project_name}"
  retention_in_days = 7
  tags              = local.common_tags
}
