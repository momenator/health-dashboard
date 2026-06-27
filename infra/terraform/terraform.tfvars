project_name        = "health-dashboard"
aws_region          = "us-west-2"
ecr_repository_name = "health-dashboard-backend"
ecs_cluster_name    = "health-dashboard-cluster"
ecs_service_name    = "health-dashboard-service"
ecs_task_family     = "health-dashboard-task"
ecs_container_name  = "health-dashboard-api"

vpc_id            = "vpc-00a86e30297a23e61"
public_subnet_ids = ["subnet-09f3d70cfcb7c67b9", "subnet-0268af2ed479c812c"]
ecs_subnet_ids    = ["subnet-09f3d70cfcb7c67b9", "subnet-0268af2ed479c812c"]

allowed_origins = [
  "http://localhost:3000",
]

allowed_ingress_cidr_blocks = [
  "0.0.0.0/0",
]

bedrock_model_id = "us.mistral.pixtral-large-2502-v1:0"

tags = {
  Owner = "hackathon-team"
}
