"""Location-based news tool using web search and Groq for summarization."""

from __future__ import annotations

import hashlib
import json
import logging
import time
from datetime import datetime, timezone
from typing import Any

import httpx

from app.core.config import get_settings

logger = logging.getLogger(__name__)

# In-memory cache: key -> (timestamp, response_data)
_cache: dict[str, tuple[float, dict]] = {}
CACHE_TTL_SECONDS = 24 * 3600  # 24 hours


def _cache_key(location: str | None, district: str | None, region: str | None, radius_km: int) -> str:
    """Generate a normalized cache key."""
    parts = [
        (location or "").strip().lower(),
        (district or "").strip().lower(),
        (region or "").strip().lower(),
        str(radius_km),
    ]
    raw = "|".join(parts)
    return hashlib.md5(raw.encode()).hexdigest()


def _get_cached(key: str) -> dict | None:
    """Return cached result if still valid."""
    if key in _cache:
        ts, data = _cache[key]
        if time.time() - ts < CACHE_TTL_SECONDS:
            logger.info(f"Cache hit for key {key[:8]}...")
            return data
        else:
            del _cache[key]
    return None


def _set_cache(key: str, data: dict):
    """Store result in cache."""
    _cache[key] = (time.time(), data)


def _build_search_queries(location: str | None, district: str | None, region: str | None) -> list[tuple[str, str]]:
    """Build fallback search query hierarchy. Returns [(query, match_level), ...]."""
    queries = []
    health_terms = "health OR humanitarian OR médecins OR santé OR epidemic OR outbreak"

    if location and district:
        queries.append((f"{location} {district} Madagascar", "location"))
    if district and region:
        queries.append((f"{district} {region} Madagascar", "district"))
    if region:
        queries.append((f"{region} Madagascar health", "region"))
    queries.append((f"Madagascar {health_terms}", "country"))

    return queries


def _search_web(query: str, days: int = 30) -> list[dict]:
    """Search the web using DuckDuckGo HTML (no API key needed).

    Returns list of {title, url, snippet, source}.
    """
    try:
        # Use DuckDuckGo HTML search
        headers = {"User-Agent": "Mozilla/5.0 (compatible; HealthBot/1.0)"}
        params = {"q": query, "df": f"d-{days}", "kl": "wt-wt"}
        resp = httpx.get(
            "https://html.duckduckgo.com/html/",
            params=params,
            headers=headers,
            timeout=10,
            follow_redirects=True,
        )
        if resp.status_code != 200:
            logger.warning(f"DuckDuckGo returned {resp.status_code}")
            return []

        # Simple HTML parsing for results
        results = []
        text = resp.text

        # Extract result blocks (basic parsing)
        import re
        # Find result links
        links = re.findall(
            r'<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>(.+?)</a>',
            text
        )
        snippets = re.findall(
            r'<a[^>]+class="result__snippet"[^>]*>(.+?)</a>',
            text
        )

        for i, (url, title) in enumerate(links[:10]):
            # Clean HTML tags from title
            clean_title = re.sub(r'<[^>]+>', '', title).strip()
            snippet = re.sub(r'<[^>]+>', '', snippets[i]).strip() if i < len(snippets) else ""

            # Extract actual URL from DuckDuckGo redirect
            url_match = re.search(r'uddg=([^&]+)', url)
            actual_url = httpx.URL(url_match.group(1)).path if url_match else url

            # Try to use the href directly if it looks like a real URL
            if url.startswith("http"):
                actual_url = url
            elif "uddg=" in url:
                from urllib.parse import unquote
                url_match = re.search(r'uddg=([^&]+)', url)
                if url_match:
                    actual_url = unquote(url_match.group(1))

            results.append({
                "title": clean_title,
                "url": actual_url,
                "snippet": snippet,
                "source": actual_url.split("/")[2] if actual_url.startswith("http") else "unknown",
            })

        return results

    except Exception as e:
        logger.error(f"Web search failed for '{query}': {e}")
        return []


def _summarize_with_groq(results: list[dict], location_context: str) -> list[dict]:
    """Use Groq to summarize, deduplicate, and rank search results."""
    settings = get_settings()
    groq_key = settings.groq_api_key

    if not groq_key or not results:
        # Return raw results without Groq processing
        return [{
            "title": r["title"],
            "source": r["source"],
            "published_at": None,
            "url": r["url"],
            "summary": r["snippet"][:200],
            "relevance_reason": "Web search result",
        } for r in results[:8]]

    from groq import Groq
    client = Groq(api_key=groq_key)

    # Build prompt
    results_text = json.dumps(results[:15], indent=2)
    prompt = f"""You are a news summarizer for a health program in Madagascar.

Location context: {location_context}

Here are raw web search results. For each relevant result:
1. Write a brief 1-2 sentence summary in English
2. Determine if it's actually relevant to this location or health/humanitarian work
3. Remove duplicates
4. Rank by relevance

Search results:
{results_text}

Return ONLY a JSON array of relevant items (max 6):
[{{"title": "...", "source": "domain", "published_at": "ISO date or null", "url": "...", "summary": "1-2 sentences", "relevance_reason": "why this is relevant"}}]

If none are relevant, return an empty array: []
Do NOT invent news. Only summarize what is in the search results."""

    try:
        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.1,
            max_tokens=2000,
        )
        content = response.choices[0].message.content.strip()

        # Parse JSON from response
        if content.startswith("```"):
            content = content.split("```")[1]
            if content.startswith("json"):
                content = content[4:]
        items = json.loads(content)
        return items if isinstance(items, list) else []

    except Exception as e:
        logger.error(f"Groq summarization failed: {e}")
        # Fallback: return raw results
        return [{
            "title": r["title"],
            "source": r["source"],
            "published_at": None,
            "url": r["url"],
            "summary": r["snippet"][:200],
            "relevance_reason": "Web search result (unprocessed)",
        } for r in results[:6]]


def get_location_news(
    lat: float | None = None,
    lon: float | None = None,
    location: str | None = None,
    district: str | None = None,
    region: str | None = None,
    radius_km: int = 50,
) -> dict[str, Any]:
    """Get location-based news for a map marker.

    Uses web search with fallback hierarchy, Groq for summarization.
    Results cached for 24 hours.
    """
    # Check cache
    key = _cache_key(location, district, region, radius_km)
    cached = _get_cached(key)
    if cached:
        return cached

    # Build search queries with fallback
    queries = _build_search_queries(location, district, region)

    all_results: list[dict] = []
    match_level = "country"

    # Try each query level, stop when we get results
    for query, level in queries:
        logger.info(f"Searching news: '{query}' (level={level})")
        results = _search_web(query, days=30)

        if not results:
            # Expand to 90 days
            results = _search_web(query, days=90)

        if results:
            all_results = results
            match_level = level
            break

    # Summarize with Groq
    location_context = " | ".join(filter(None, [location, district, region, "Madagascar"]))
    items = _summarize_with_groq(all_results, location_context)

    # Add match_level to each item
    for item in items:
        item["match_level"] = match_level

    response = {
        "location_context": {
            "location": location,
            "district": district,
            "region": region,
            "lat": lat,
            "lon": lon,
            "radius_km": radius_km,
            "search_level_used": match_level,
        },
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "cache_ttl_hours": 24,
        "items": items,
    }

    # Cache the result
    _set_cache(key, response)

    return response
