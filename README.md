# AI4Good Health Chatbot Backend

AI-powered chatbot backend for the AI4Good health program. Uses OpenAI for natural language understanding and Athena (or local CSV fallback) for data queries over anonymized reporting datasets.

## Architecture

```
Lovable Frontend → API Gateway → FastAPI on ECS → Router → Tool Handlers
                                                         → OpenAI
                                                         → Athena / Local CSV
```

## Features

- **Intent Router**: Classifies questions into data_lookup, chart, explanation, recommendation, report_text, prediction, or clarification
- **SQL Safety**: Validates all queries - blocks INSERT/UPDATE/DELETE/DROP and restricts to reporting tables only
- **Confidence-Aware**: Uses data quality/confidence columns to add caveats to answers
- **Chart Generation**: Returns frontend-friendly chart JSON (bar, line, pie, table)
- **Report Writing**: Generates polished annual-report paragraphs
- **Privacy Protection**: Refuses requests for names, phone numbers, CIN, photos, or private identifiers
- **Prediction Stub**: Graceful handling of future risk-scoring features

## Dataset

All data lives in `data/reporting/`:

| Table | Domain | Description |
|-------|--------|-------------|
| tb_patient_journey | Tuberculosis | TB screening, diagnosis, treatment, outcomes |
| mchp_patient_support | Maternal/Child Health | Patient support, vulnerability, treatment |
| ambulance_trips | Emergency | Ambulance trips, distance, response time |
| ambulance_causes | Emergency | Aggregated cause counts |
| community_workers | Community Health | CHW profiles, coverage, training |
| sensitization_activities | Awareness | Activity records, participants, referrals |
| reporting_catalog | Metadata | Table descriptions, row counts, domains |

## Quick Start (Local Development)

```bash
# 1. Install dependencies
uv sync

# 2. Copy environment config
cp .env.example .env

# 3. Run the server (model provider optional, uses local CSV)
uv run uvicorn app.main:app --reload --port 8000

# 4. Test it
curl -X POST http://localhost:8000/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "How many TB screenings are in the dataset?"}'
```

## API Endpoints

### POST /chat

Main chat endpoint.

**Request:**
```json
{
  "message": "Show TB screenings by district",
  "conversation_id": "optional-id",
  "user_context": {}
}
```

**Response:**
```json
{
  "type": "answer",
  "answer": "There are 4495 TB screenings across 2 districts...",
  "chart": null,
  "evidence": [{"table": "tb_patient_journey", "metric": "query_results", "value": 5}],
  "quality_note": "This answer uses tb_patient_journey. The result includes high, medium, and low confidence rows.",
  "suggested_followups": ["Show this as a chart.", "Give me recommendations based on this data."]
}
```

### GET /health

Health check.

### GET /schema

Returns table schemas and catalog info.

### GET /tables

Lists available reporting tables.

### POST /upload-data

Uploads a CSV or XLSX file and publishes only a sanitized CSV copy for downstream analysis.
The raw upload is stored outside the reporting data directory; the chatbot and
query tools only read the sanitized CSV written to `DATA_DIR`.

Optional environment variables:

| Variable | Description |
|----------|-------------|
| PII_SANITIZER_SCRIPT | Path to an existing Python PII removal script. Expected interface: `python script.py <input_csv> <output_csv>` |
| UPLOAD_RAW_DIR | Directory for raw uploads, outside `DATA_DIR` |
| UPLOAD_QUARANTINE_DIR | Directory for uploads that fail sanitization |

The built-in fallback sanitizer removes columns with common PII names, redacts
emails/phone-like values/URLs in retained fields, and pseudonymizes trace IDs
such as `record_id`.

### GET /external-context

Fetches public Madagascar context signals for uploaded M&E datasets and reports. The backend uses
GDELT as the public web/news source and can optionally use Groq to rank and
summarize relevance when `ENABLE_GROQ_CONTEXT=true` and `GROQ_API_KEY` is set.
Uploaded health data is not sent to Groq; only project name/region and short
aggregate change text are used.

## AWS Deployment

### Prerequisites

- OpenAI API key
- Terraform installed
- Docker (or compatible container runtime)

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| AWS_REGION | AWS region | Yes |
| ENABLE_OPENAI | Enable OpenAI models | Yes |
| OPENAI_API_KEY | OpenAI API key for backend model calls | Yes |
| OPENAI_MODEL | Default OpenAI model | Yes |
| ENABLE_GROQ_CONTEXT | Use Groq to rank/summarize public context signals | No |
| GROQ_API_KEY | Groq API key for public-context ranking only | No |
| GROQ_MODEL | Groq model for public-context ranking | No |
| ATHENA_DATABASE | Glue/Athena database name | Yes (production) |
| ATHENA_OUTPUT_S3 | S3 path for Athena results | Yes (production) |
| ALLOWED_TABLES | Comma-separated allowed table names | Yes |
| MAX_QUERY_ROWS | Default LIMIT for queries | No (default: 1000) |
| ALLOWED_ORIGINS | CORS origins | Yes |
| DATA_DIR | Local CSV directory | No (default: data/reporting) |

### Data Deployment to S3

Upload the reporting CSVs:

```bash
aws s3 sync data/reporting/ s3://<your-bucket>/ai4good-health/reporting/2026/
```

### Glue/Athena Setup

Create a Glue database and crawler, or manually create tables:

```sql
CREATE EXTERNAL TABLE ai4good_health.tb_patient_journey (
  domain STRING, grain STRING, record_id STRING, ...
)
ROW FORMAT DELIMITED FIELDS TERMINATED BY ','
STORED AS TEXTFILE
LOCATION 's3://<bucket>/ai4good-health/reporting/2026/tb_patient_journey/';
```

Repeat for each table.

### IAM Permissions

The backend role needs:
- `athena:StartQueryExecution`, `athena:GetQueryExecution`, `athena:GetQueryResults`
- `glue:GetDatabase`, `glue:GetTable`, `glue:GetTables`
- `s3:GetObject` for reporting/ prefix only
- `s3:PutObject` for Athena output location
- CloudWatch Logs permissions

The backend role should NOT have access to private/, raw/, cleaned/, or quality/ prefixes.

### Deploy to ECS

```bash
# Fill in deployment config
cp .env.deploy.example .env.deploy
# Edit .env.deploy with your AWS values

# Run the deploy script
./scripts/deploy.sh
```

## Running Tests

```bash
uv run pytest -v
```

## Project Structure

```
app/
├── main.py              # FastAPI app entry point
├── router.py            # Intent classification & dispatch
├── schemas.py           # Pydantic request/response models
├── api/
│   └── routes.py        # HTTP endpoints
├── core/
│   └── config.py        # Settings & environment variables
├── models/
│   ├── model_client.py   # Model wrapper
│   ├── openai_client.py  # OpenAI Responses API wrapper
│   └── prompts.py       # Prompt templates per role
└── tools/
    ├── athena.py        # SQL validation & query execution
    ├── schema.py        # Table schema lookups
    ├── confidence.py    # Quality/confidence caveats
    ├── charts.py        # Chart JSON generation
    ├── recommendations.py # Evidence-based recommendations
    ├── reports.py       # Annual report text generation
    └── predictions.py   # Prediction stub

data/reporting/          # Anonymized CSV datasets
tests/                   # Test suite
infra/terraform/         # Infrastructure as code
```

## Example Questions

1. "How many TB screenings are in the dataset?"
2. "Show TB screenings by district as a bar chart."
3. "Explain what data confidence means."
4. "Which ambulance site has the longest average response time?"
5. "Give recommendations for improving follow-up."
6. "Write an annual report paragraph about TB screening activity."
7. "What are the phone numbers of patients?" → Refused with explanation.
