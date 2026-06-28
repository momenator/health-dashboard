"""Public news/context retrieval for M&E situation briefs."""

from __future__ import annotations

import hashlib
import json
import logging
import re
from datetime import datetime, timedelta, timezone
from typing import Any
from urllib.parse import urlencode

import httpx

from app.core.config import get_settings
from app.schemas import PublicContextItem, PublicContextResponse

logger = logging.getLogger(__name__)

GDELT_DOC_URL = "https://api.gdeltproject.org/api/v2/doc/doc"
GROQ_CHAT_URL = "https://api.groq.com/openai/v1/chat/completions"

PROJECT_TERMS = {
    "miray-tb": ["tuberculosis", "TB", "HIV", "screening", "medicine", "health"],
    "mchp": ["maternal", "antenatal", "pregnancy", "child health", "ambulance", "health"],
    "mafy": ["stroke", "hypertension", "blood pressure", "hospital", "health"],
    "tia-longo": ["poverty", "healthcare cost", "inflation", "transport", "hospital"],
    "profess": ["community health worker", "training", "health worker", "health"],
}

REGION_TERMS = {
    "North": ["SAVA", "Diana", "Sambava", "Antsiranana", "Ambanja"],
    "Highlands": ["Analamanga", "Itasy", "Vakinankaratra", "Antananarivo"],
    "East": ["Atsinanana", "Toamasina", "Vatovavy", "Fitovinany"],
    "South": ["Anosy", "Androy", "Taolagnaro", "Toliara", "Ampanihy"],
    "Southwest": ["Atsimo-Andrefana", "Toliara", "Betioky", "Ampanihy"],
}

CATEGORY_KEYWORDS = {
    "cyclone": ["cyclone", "storm", "flood", "inondation", "tempête"],
    "outbreak": ["outbreak", "epidemic", "cholera", "measles", "paludisme", "malaria", "disease"],
    "political": ["protest", "election", "government", "manifestation", "political", "strike"],
    "logistics": ["road", "transport", "fuel", "supply", "bridge", "access", "route"],
    "climate": ["drought", "rainfall", "rain", "dry season", "climate", "sécheresse"],
    "health_system": ["hospital", "health", "ministry", "medicine", "clinic", "doctor", "santé"],
    "economy": ["price", "inflation", "poverty", "food", "cost", "ariary"],
}


def fetch_public_context(
    *,
    project_id: str | None,
    region: str | None,
    changes: str | None,
    limit: int = 6,
    days: int = 45,
) -> PublicContextResponse:
    """Fetch and rank public Madagascar context items."""
    source = "GDELT public web/news index"
    try:
        candidates = _fetch_gdelt(project_id=project_id, region=region, changes=changes, days=days)
    except Exception as e:
        logger.warning(f"GDELT context lookup failed, using curated fallback: {e}")
        candidates = _fallback_articles(region=region)
        source = "Curated Madagascar context fallback"

    heuristic_items = _rank_heuristically(
        candidates,
        project_id=project_id,
        region=region,
        changes=changes,
        limit=limit,
    )

    settings = get_settings()
    if settings.enable_groq_context and settings.groq_api_key and heuristic_items:
        try:
            groq_items = _rank_with_groq(
                heuristic_items,
                project_id=project_id,
                region=region,
                changes=changes,
                limit=limit,
            )
            return PublicContextResponse(
                project_id=project_id,
                region=region,
                source=source,
                generated_by="groq",
                items=groq_items,
                note=CONTEXT_NOTE,
            )
        except Exception as e:
            logger.warning(f"Groq context ranking failed, using heuristic ranking: {e}")

    return PublicContextResponse(
        project_id=project_id,
        region=region,
        source=source,
        generated_by="heuristic",
        items=heuristic_items,
        note=CONTEXT_NOTE,
    )


CONTEXT_NOTE = (
    "Public context items are possible explanations only. They do not prove causality "
    "and should be validated with field teams before external reporting."
)


def _fetch_gdelt(
    *,
    project_id: str | None,
    region: str | None,
    changes: str | None,
    days: int,
) -> list[dict[str, Any]]:
    query = _build_query(project_id=project_id, region=region, changes=changes)
    end = datetime.now(timezone.utc)
    start = end - timedelta(days=max(1, min(days, 180)))
    params = {
        "query": query,
        "mode": "ArtList",
        "format": "json",
        "maxrecords": 50,
        "sort": "HybridRel",
        "startdatetime": start.strftime("%Y%m%d%H%M%S"),
        "enddatetime": end.strftime("%Y%m%d%H%M%S"),
    }
    url = f"{GDELT_DOC_URL}?{urlencode(params)}"
    with httpx.Client(timeout=8.0, follow_redirects=True) as client:
        response = client.get(url)
        response.raise_for_status()
        payload = response.json()
    return payload.get("articles", []) or []


def _fallback_articles(*, region: str | None) -> list[dict[str, Any]]:
    region_text = region or "Madagascar"
    return [
        {
            "title": f"Cyclone and flood risks can disrupt access to health facilities in {region_text}",
            "url": "https://reliefweb.int/country/mdg",
            "domain": "reliefweb.int",
            "seendate": datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S"),
            "sourcecountry": "Madagascar",
        },
        {
            "title": f"Road access, fuel availability, and transport costs may affect outreach in {region_text}",
            "url": "https://gdacs.org/",
            "domain": "gdacs.org",
            "seendate": datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S"),
            "sourcecountry": "Madagascar",
        },
        {
            "title": "Health system supply and staffing constraints can affect service utilization in Madagascar",
            "url": "https://www.who.int/countries/mdg",
            "domain": "who.int",
            "seendate": datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S"),
            "sourcecountry": "Madagascar",
        },
    ]


def _build_query(*, project_id: str | None, region: str | None, changes: str | None) -> str:
    terms = [
        "Madagascar",
        "health",
        "cyclone",
        "flood",
        "outbreak",
        "protest",
        "fuel",
        "road",
        "drought",
        "hospital",
    ]
    terms.extend(PROJECT_TERMS.get(project_id or "", []))
    terms.extend(REGION_TERMS.get(region or "", []))
    terms.extend(_keywords_from_text(changes or ""))
    unique = list(dict.fromkeys(t for t in terms if t))
    return " OR ".join(f'"{term}"' if " " in term else term for term in unique[:24])


def _keywords_from_text(text: str) -> list[str]:
    words = re.findall(r"[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ-]{3,}", text.lower())
    stop = {
        "with",
        "from",
        "that",
        "this",
        "project",
        "district",
        "rate",
        "data",
        "reported",
        "recommended",
    }
    return [w for w in words if w not in stop][:8]


def _rank_heuristically(
    articles: list[dict[str, Any]],
    *,
    project_id: str | None,
    region: str | None,
    changes: str | None,
    limit: int,
) -> list[PublicContextItem]:
    scored = []
    for article in articles:
        title = (article.get("title") or "").strip()
        url = (article.get("url") or "").strip()
        if not title or not url:
            continue
        text = " ".join(
            str(article.get(key, ""))
            for key in ("title", "domain", "sourcecountry", "language")
        ).lower()
        category = _categorize(text)
        score = _score_article(
            text,
            category=category,
            project_id=project_id,
            region=region,
            changes=changes,
        )
        if score <= 0:
            continue
        scored.append((score, article, category))

    scored.sort(key=lambda item: item[0], reverse=True)
    items = []
    for score, article, category in scored[:limit]:
        title = article.get("title", "").strip()
        source_url = article.get("url", "").strip()
        source = article.get("domain") or article.get("sourcecountry") or "Public web"
        locations = _locations_for_article(str(title), region)
        items.append(
            PublicContextItem(
                id=_stable_id(source_url),
                title=title,
                date=_format_gdelt_date(article.get("seendate")),
                source=str(source),
                source_url=source_url,
                category=category,
                locations=locations,
                summary=title,
                relevance=_relevance_sentence(category, project_id, region),
                confidence="high" if score >= 6 else "medium" if score >= 3 else "low",
            )
        )
    return items


def _score_article(
    text: str,
    *,
    category: str,
    project_id: str | None,
    region: str | None,
    changes: str | None,
) -> int:
    score = 0
    if "madagascar" in text or "malagasy" in text:
        score += 2
    for term in PROJECT_TERMS.get(project_id or "", []):
        if term.lower() in text:
            score += 2
    for term in REGION_TERMS.get(region or "", []):
        if term.lower() in text:
            score += 2
    for term in _keywords_from_text(changes or ""):
        if term.lower() in text:
            score += 1
    if category != "other":
        score += 2
    return score


def _categorize(text: str):
    for category, keywords in CATEGORY_KEYWORDS.items():
        if any(keyword.lower() in text for keyword in keywords):
            return category
    return "other"


def _locations_for_article(title: str, region: str | None) -> list[str]:
    locations = []
    if region:
        locations.append(region)
    lower = title.lower()
    for terms in REGION_TERMS.values():
        for term in terms:
            if term.lower() in lower and term not in locations:
                locations.append(term)
    return locations[:4]


def _relevance_sentence(category: str, project_id: str | None, region: str | None) -> str:
    project = project_id.replace("-", " ").upper() if project_id else "the selected project"
    region_text = f" in {region}" if region else ""
    return (
        f"This {category.replace('_', ' ')} item may help explain changes for "
        f"{project}{region_text}, but it should be treated as context rather than proof."
    )


def _format_gdelt_date(seendate: Any) -> str:
    raw = str(seendate or "")
    if len(raw) >= 8 and raw[:8].isdigit():
        return f"{raw[:4]}-{raw[4:6]}-{raw[6:8]}"
    return raw[:10] or datetime.now(timezone.utc).date().isoformat()


def _stable_id(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()[:16]


def _rank_with_groq(
    items: list[PublicContextItem],
    *,
    project_id: str | None,
    region: str | None,
    changes: str | None,
    limit: int,
) -> list[PublicContextItem]:
    settings = get_settings()
    prompt = {
        "task": "Rank public Madagascar context items for an NGO M&E situation brief.",
        "rules": [
            "Return only valid JSON.",
            "Do not claim causality.",
            "Use cautious language: possible explanation, needs field validation.",
            "Keep source_url unchanged.",
        ],
        "project_id": project_id,
        "region": region,
        "observed_aggregate_changes": changes,
        "items": [item.model_dump() for item in items[:12]],
    }
    headers = {
        "Authorization": f"Bearer {settings.groq_api_key}",
        "Content-Type": "application/json",
    }
    body = {
        "model": settings.groq_model,
        "temperature": 0,
        "messages": [
            {
                "role": "system",
                "content": (
                    "You classify public news/context for humanitarian health M&E. "
                    "Return JSON with an 'items' array matching the provided schema."
                ),
            },
            {"role": "user", "content": json.dumps(prompt, ensure_ascii=False)},
        ],
        "response_format": {"type": "json_object"},
    }
    with httpx.Client(timeout=12.0) as client:
        response = client.post(GROQ_CHAT_URL, headers=headers, json=body)
        response.raise_for_status()
        payload = response.json()
    content = payload["choices"][0]["message"]["content"]
    parsed = json.loads(_strip_code_fence(content))
    ranked = [PublicContextItem(**item) for item in parsed.get("items", [])]
    return ranked[:limit]


def _strip_code_fence(text: str) -> str:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.split("```")[1]
        if cleaned.startswith("json"):
            cleaned = cleaned[4:]
    return cleaned.strip()
