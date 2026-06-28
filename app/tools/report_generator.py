"""Structured report generator - returns JSON for frontend rendering."""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any, Literal

from app.core.config import get_settings
from app.models.bedrock_client import invoke_model
from app.tools.annual_report import compute_kpis, _load_csv, _safe_float, _count_where

logger = logging.getLogger(__name__)

ReportType = Literal["internal", "donor", "portfolio_review"]
ReportScope = Literal["portfolio", "individual"]
ReportPeriod = Literal["annual_2026", "h2_2026", "q4_2026"]

PROJECT_DOMAINS = {
    "mchp_patient_support": "Financial Access and Patient Support",
    "ambulance_trips": "Ambulance and Emergency Referrals",
    "tb_patient_journey": "Tuberculosis Patient Journey",
    "community_workers": "Community Health Workers",
    "sensitization_activities": "Community Mobilization",
}


def generate_report(
    report_type: ReportType = "internal",
    period: ReportPeriod = "annual_2026",
    scope: ReportScope = "portfolio",
    project: str | None = None,
    include_data_quality: bool = True,
    include_source_coverage: bool = False,
) -> dict[str, Any]:
    """Generate structured report data for frontend rendering.

    Returns a JSON-serializable dict with all sections, KPIs, insights, and narratives.
    """
    settings = get_settings()
    data_dir = Path(settings.data_dir)

    # Compute KPIs
    kpis = compute_kpis(data_dir)

    # Build report structure
    report: dict[str, Any] = {
        "metadata": {
            "report_type": report_type,
            "report_type_label": _get_type_label(report_type),
            "period": period,
            "period_label": _get_period_label(period),
            "scope": scope,
            "project": project,
            "project_label": PROJECT_DOMAINS.get(project, project) if project else "All Projects",
            "generated_at": __import__("datetime").datetime.now().isoformat(),
            "title": _build_title(report_type, period, scope, project),
            "subtitle": _get_subtitle(report_type),
            "filename": _build_filename(report_type, period, scope, project),
        },
        "headline_kpis": _build_headline_kpis(kpis, scope, project),
        "executive_summary": None,
        "dashboard": _build_dashboard(kpis, scope, project),
        "project_chapters": _build_project_chapters(kpis, scope, project),
        "actionable_insights": None,
        "audience_section": None,
    }

    if include_data_quality:
        report["data_quality"] = _build_data_quality(kpis)

    if include_source_coverage:
        report["source_coverage"] = kpis.get("source_coverage", [])

    # Generate AI narratives
    report["executive_summary"] = _generate_executive_summary(kpis, report_type, scope, project)
    report["actionable_insights"] = _generate_insights(kpis, report_type, scope, project)
    report["audience_section"] = _generate_audience_section(kpis, report_type, scope, project)

    return report


def _get_type_label(report_type: str) -> str:
    return {
        "internal": "Internal Action Review",
        "donor": "Donor Impact Report",
        "portfolio_review": "Annual Portfolio Review",
    }.get(report_type, report_type)


def _get_period_label(period: str) -> str:
    return {
        "annual_2026": "Annual 2026",
        "h2_2026": "H2 2026",
        "q4_2026": "Q4 2026",
    }.get(period, period)


def _get_subtitle(report_type: str) -> str:
    return {
        "internal": "What needs attention, what is working, and where managers should act next.",
        "donor": "How DfM's work translated into access, treatment, and protection for vulnerable communities.",
        "portfolio_review": "A cross-project view of reach, performance, learning, and strategic priorities.",
    }.get(report_type, "")


def _build_title(report_type: str, period: str, scope: str, project: str | None) -> str:
    type_label = _get_type_label(report_type)
    period_label = _get_period_label(period)
    if scope == "portfolio":
        return f"DfM {type_label} | Portfolio | {period_label}"
    else:
        project_label = PROJECT_DOMAINS.get(project, project or "Project")
        return f"DfM {type_label} | {project_label} | {period_label}"


def _build_filename(report_type: str, period: str, scope: str, project: str | None) -> str:
    type_part = {"internal": "Internal_Action_Review", "donor": "Donor_Impact_Report", "portfolio_review": "Annual_Portfolio_Review"}.get(report_type, "Report")
    period_part = period.replace("_", "_").upper().replace("ANNUAL_2026", "2026").replace("H2_2026", "H2_2026").replace("Q4_2026", "Q4_2026")
    if scope == "portfolio":
        return f"DfM_{type_part}_Portfolio_{period_part}.pdf"
    else:
        proj_short = (project or "project").replace("_", " ").title().replace(" ", "_")[:20]
        return f"DfM_{type_part}_{proj_short}_{period_part}.pdf"


def _build_headline_kpis(kpis: dict, scope: str, project: str | None) -> list[dict]:
    """Build 3-5 headline KPI items."""
    if scope == "portfolio" or not project:
        return [
            {"label": "Patient Support Cases", "value": str(kpis["mchp_cases"]), "context": "financial barriers reduced"},
            {"label": "Ambulance Trips", "value": str(kpis["ambulance_trips"]), "context": "emergency transport provided"},
            {"label": "TB Records", "value": str(kpis["tb_records"]), "context": "screening and treatment journeys"},
            {"label": "Community Workers", "value": str(kpis["workers_total"]), "context": "active in the field"},
            {"label": "Sensitization Participants", "value": str(kpis["sensitization_participants"]), "context": "reached through outreach"},
        ]
    # Individual project
    project_kpis = {
        "mchp_patient_support": [
            {"label": "Cases Supported", "value": str(kpis["mchp_cases"]), "context": "across " + str(kpis["mchp_sites"]) + " sites"},
            {"label": "DfM Financial Share", "value": f"{kpis['mchp_dfm_share']:.1f}%", "context": "of patient costs covered"},
            {"label": "Catastrophic Expenses Avoided", "value": str(kpis["mchp_catastrophic_avoided"]), "context": "families protected"},
        ],
        "ambulance_trips": [
            {"label": "Trips Completed", "value": str(kpis["ambulance_trips"]), "context": "emergency referrals"},
            {"label": "Total Distance", "value": f"{kpis['ambulance_total_distance']:.0f} km", "context": "covered by ambulances"},
            {"label": "Median Response", "value": f"{kpis['ambulance_median_response']:.1f} hrs", "context": "call to arrival"},
            {"label": "Cure Rate", "value": f"{kpis['ambulance_cured_rate']:.0f}%", "context": "positive outcomes"},
        ],
        "tb_patient_journey": [
            {"label": "Journey Records", "value": str(kpis["tb_records"]), "context": "screenings and treatments"},
            {"label": "Positive Cases", "value": str(kpis["tb_positive"]), "context": "cases detected"},
            {"label": "Treatment Starts", "value": str(kpis["tb_treatment_starts"]), "context": "patients on treatment"},
            {"label": "Diagnostic Centers", "value": str(kpis["tb_diagnostic_centers"]), "context": "active facilities"},
        ],
        "community_workers": [
            {"label": "Total Workers", "value": str(kpis["workers_total"]), "context": "community health agents"},
            {"label": "Active Rate", "value": f"{kpis['workers_active_rate']:.0f}%", "context": "currently active"},
            {"label": "Trained", "value": str(kpis["workers_trained"]), "context": "received training"},
        ],
        "sensitization_activities": [
            {"label": "Activities", "value": str(kpis["sensitization_activities"]), "context": "sessions conducted"},
            {"label": "Participants", "value": str(kpis["sensitization_participants"]), "context": "people reached"},
            {"label": "Referrals", "value": str(kpis["sensitization_referrals"]), "context": "referred to services"},
        ],
    }
    return project_kpis.get(project, [{"label": "Records", "value": "N/A", "context": ""}])


def _build_dashboard(kpis: dict, scope: str, project: str | None) -> dict[str, Any]:
    """Build dashboard metrics."""
    return {
        "patient_support": {"cases": kpis["mchp_cases"], "sites": kpis["mchp_sites"], "dfm_share": round(kpis["mchp_dfm_share"], 1)},
        "ambulance": {"trips": kpis["ambulance_trips"], "distance_km": round(kpis["ambulance_total_distance"]), "median_response_hrs": round(kpis["ambulance_median_response"], 2), "cure_rate": round(kpis["ambulance_cured_rate"], 1)},
        "tb": {"records": kpis["tb_records"], "positive": kpis["tb_positive"], "treatment_starts": kpis["tb_treatment_starts"], "centers": kpis["tb_diagnostic_centers"]},
        "community": {"workers": kpis["workers_total"], "active": kpis["workers_active"], "active_rate": round(kpis["workers_active_rate"]), "trained": kpis["workers_trained"]},
        "sensitization": {"activities": kpis["sensitization_activities"], "participants": kpis["sensitization_participants"], "referrals": kpis["sensitization_referrals"]},
        "data_quality": {"confidence_rate": round(kpis["confidence_rate"], 1), "high": kpis["confidence_counts"]["high"], "medium": kpis["confidence_counts"]["medium"], "low": kpis["confidence_counts"]["low"]},
        "ambulance_top_causes": [{"cause": c, "count": int(n)} for c, n in kpis.get("ambulance_top_causes", [])[:10]],
    }


def _build_project_chapters(kpis: dict, scope: str, project: str | None) -> list[dict]:
    """Build project chapter summaries with AI narratives."""
    settings = get_settings()

    chapters = [
        {
            "id": "mchp_patient_support",
            "title": "Financial Access and Patient Support",
            "purpose": "Reduce financial barriers to healthcare for vulnerable populations.",
            "status": "active",
            "metrics": {"cases": kpis["mchp_cases"], "sites": kpis["mchp_sites"], "dfm_share": f"{kpis['mchp_dfm_share']:.1f}%", "catastrophic_avoided": kpis["mchp_catastrophic_avoided"]},
        },
        {
            "id": "ambulance_trips",
            "title": "Ambulance and Emergency Referrals",
            "purpose": "Provide emergency transport for patients who cannot reach health facilities.",
            "status": "active",
            "metrics": {"trips": kpis["ambulance_trips"], "distance_km": f"{kpis['ambulance_total_distance']:.0f}", "median_response_hrs": f"{kpis['ambulance_median_response']:.2f}", "cure_rate": f"{kpis['ambulance_cured_rate']:.1f}%"},
        },
        {
            "id": "tb_patient_journey",
            "title": "Tuberculosis Patient Journey",
            "purpose": "Screen, diagnose, and treat TB patients through community-based case finding.",
            "status": "active",
            "metrics": {"records": kpis["tb_records"], "positive": kpis["tb_positive"], "treatments_started": kpis["tb_treatment_starts"], "centers": kpis["tb_diagnostic_centers"]},
        },
        {
            "id": "community_workers",
            "title": "Community Health Workers",
            "purpose": "Deploy trained community agents to extend health service coverage.",
            "status": "active",
            "metrics": {"total": kpis["workers_total"], "active": kpis["workers_active"], "active_rate": f"{kpis['workers_active_rate']:.0f}%", "trained": kpis["workers_trained"], "with_bicycle": kpis["workers_bicycle"]},
        },
        {
            "id": "sensitization_activities",
            "title": "Community Mobilization",
            "purpose": "Raise health awareness and generate referrals through community activities.",
            "status": "active",
            "metrics": {"activities": kpis["sensitization_activities"], "participants": kpis["sensitization_participants"], "referrals": kpis["sensitization_referrals"]},
        },
    ]

    if scope == "individual" and project:
        chapters = [c for c in chapters if c["id"] == project]

    # Generate per-chapter narratives if Bedrock is available
    if settings.enable_bedrock:
        for chapter in chapters:
            try:
                metrics_str = ", ".join(f"{k}: {v}" for k, v in chapter["metrics"].items())
                chapter["narrative"] = invoke_model(
                    f"""Write a 150-word project summary for '{chapter['title']}' in a DfM annual report.
Metrics: {metrics_str}
Purpose: {chapter['purpose']}
Include: what went well, what needs attention, recommended next step. Be specific with numbers.""",
                    role="report", max_tokens=800, temperature=0.3
                )
            except Exception:
                chapter["narrative"] = None

    return chapters


def _build_data_quality(kpis: dict) -> dict:
    """Build data quality section."""
    cc = kpis["confidence_counts"]
    total = cc["high"] + cc["medium"] + cc["low"]
    return {
        "overall_confidence_rate": round(kpis["confidence_rate"], 1),
        "high_confidence": cc["high"],
        "medium_confidence": cc["medium"],
        "low_confidence": cc["low"],
        "total_records": total,
        "note": "Records with low confidence should be reviewed before use in external reporting.",
    }


def _generate_executive_summary(kpis: dict, report_type: str, scope: str, project: str | None) -> str:
    """Generate AI executive summary based on audience."""
    settings = get_settings()
    if not settings.enable_bedrock:
        return f"Executive summary for {_get_type_label(report_type)} covering {_get_period_label('annual_2026')}."

    audience_instruction = {
        "internal": "Write for project managers. Focus on what needs attention, what is working, operational risks, and recommended actions. Be direct and specific. Include a 'Management Attention Needed' section.",
        "donor": "Write for donors/funders. Focus on impact, people reached, services delivered, challenges managed transparently. Be warm and credible. Include 'What your support enabled' framing.",
        "portfolio_review": """Write for senior leadership conducting an annual portfolio review. This should be comprehensive and substantive. Include:
1. Overall portfolio performance summary (what happened across all projects)
2. Cross-project themes and patterns
3. Major achievements and milestones
4. Key challenges and how they were managed
5. Strategic progress against program goals
6. What we learned this year
7. Priorities and outlook for next period
8. Resource allocation observations

Be analytical, not just descriptive. Connect metrics to strategic meaning. Identify what the numbers tell us about program maturity, coverage gaps, and operational efficiency.""",
    }.get(report_type, "")

    word_count = "800-1000" if report_type == "portfolio_review" else "400-500" if report_type == "donor" else "300-400"

    prompt = f"""Write a {word_count}-word executive summary for a Doctors for Madagascar (DfM) health program report.

{audience_instruction}

Key metrics:
- Patient support (MCHP): {kpis['mchp_cases']} cases across {kpis['mchp_sites']} sites, DfM covered {kpis['mchp_dfm_share']:.1f}% of costs, {kpis['mchp_catastrophic_avoided']} catastrophic expenses avoided
- Ambulance: {kpis['ambulance_trips']} trips, {kpis['ambulance_total_distance']:.0f} km total distance, median response {kpis['ambulance_median_response']:.2f} hours, cure rate {kpis['ambulance_cured_rate']:.1f}%
- TB program: {kpis['tb_records']} patient journey records, {kpis['tb_positive']} positive cases detected, {kpis['tb_treatment_starts']} treatments started, {kpis['tb_diagnostic_centers']} diagnostic centers active
- Community workers: {kpis['workers_total']} total, {kpis['workers_active']} active ({kpis['workers_active_rate']:.0f}%), {kpis['workers_trained']} trained, {kpis['workers_materials']} with materials, {kpis['workers_bicycle']} with bicycles
- Sensitization: {kpis['sensitization_activities']} activities, {kpis['sensitization_participants']} participants reached, {kpis['sensitization_referrals']} referrals made
- Data confidence: {kpis['confidence_rate']:.1f}% high confidence records

Do not invent facts. Be specific with numbers. Use markdown formatting with headers."""

    try:
        return invoke_model(prompt, role="report", max_tokens=4000, temperature=0.3)
    except Exception as e:
        logger.error(f"Executive summary generation failed: {e}")
        return "Executive summary generation failed. Please retry."


def _generate_insights(kpis: dict, report_type: str, scope: str, project: str | None) -> list[dict]:
    """Generate actionable insights."""
    settings = get_settings()
    if not settings.enable_bedrock:
        return [{"title": "Data available", "severity": "low", "evidence": "All tables loaded", "action": "Review metrics"}]

    insight_count = "8-10" if report_type == "portfolio_review" else "5-7"

    prompt = f"""Based on these health program KPIs, generate {insight_count} actionable insights as a JSON array.

Program data (Doctors for Madagascar, southern Madagascar):
- Patient support (MCHP): {kpis['mchp_cases']} cases across {kpis['mchp_sites']} sites, DfM covered {kpis['mchp_dfm_share']:.1f}%, catastrophic expenses avoided: {kpis['mchp_catastrophic_avoided']}
- Ambulance: {kpis['ambulance_trips']} trips, total {kpis['ambulance_total_distance']:.0f} km, cure rate {kpis['ambulance_cured_rate']:.1f}%, median response {kpis['ambulance_median_response']:.2f} hrs
- TB: {kpis['tb_positive']} positive of {kpis['tb_records']} screened, {kpis['tb_treatment_starts']} started treatment, {kpis['tb_diagnostic_centers']} diagnostic centers
- Community workers: {kpis['workers_total']} total, {kpis['workers_active_rate']:.0f}% active, {kpis['workers_trained']} trained, {kpis['workers_bicycle']} have bicycles, {kpis['workers_financial']} have financial support
- Sensitization: {kpis['sensitization_referrals']} referrals from {kpis['sensitization_activities']} activities reaching {kpis['sensitization_participants']} participants
- Data quality: {kpis['confidence_rate']:.1f}% high confidence, {kpis['confidence_counts']['low']} low-confidence records

Generate insights that cover:
- Performance outliers (good or concerning)
- Operational bottlenecks
- Resource gaps (e.g., workers without bicycles affecting coverage)
- Data quality issues affecting decisions
- Cross-project connections (e.g., sensitization referrals → TB detection)
- High-impact opportunities

Each insight MUST have these fields:
- title: clear action-oriented title
- severity: "high" | "medium" | "low"
- evidence: cite specific metrics
- possible_explanation: operational/contextual hypothesis (use cautious language)
- recommended_action: specific next step
- suggested_owner: "Project Manager" | "M&E Team" | "Data Manager" | "Field Team" | "Finance" | "Senior Leadership"

Do not invent data. Use language like "This may indicate" or "Possible explanation."
Respond ONLY with a JSON array."""

    try:
        response = invoke_model(prompt, role="answer", max_tokens=4000, temperature=0.3)
        clean = response.strip()
        if clean.startswith("```"):
            clean = clean.split("```")[1]
            if clean.startswith("json"):
                clean = clean[4:]
        return json.loads(clean)
    except Exception as e:
        logger.error(f"Insight generation failed: {e}")
        return [{"title": "Insight generation failed", "severity": "low", "evidence": str(e), "recommended_action": "Retry"}]


def _generate_audience_section(kpis: dict, report_type: str, scope: str, project: str | None) -> dict[str, Any]:
    """Generate audience-specific section content with AI narratives."""
    settings = get_settings()

    if report_type == "internal":
        content = {
            "type": "internal",
            "sections": ["management_actions", "data_issues", "operational_risks", "followup_questions"],
            "followup_questions": [
                "Which sites have the longest ambulance response times?",
                "How many TB patients started but didn't complete treatment?",
                "Which community workers haven't been supervised recently?",
                "What are the low-confidence records affecting?",
                "What is the referral-to-detection conversion rate from sensitization?",
            ],
        }
        if settings.enable_bedrock:
            try:
                content["narrative"] = invoke_model(
                    f"""Write a 400-word 'Management Actions Required' section for DfM internal review.
Based on: {kpis['ambulance_trips']} ambulance trips (response {kpis['ambulance_median_response']:.2f} hrs), {kpis['tb_treatment_starts']} TB treatments started of {kpis['tb_positive']} positive, {kpis['workers_active_rate']:.0f}% worker activity rate, {kpis['workers_bicycle']} of {kpis['workers_total']} workers have bicycles.
Include: top 5 priority actions with severity, operational risks, decisions needed this quarter. Use markdown headers.""",
                    role="report", max_tokens=2000, temperature=0.3
                )
            except Exception:
                pass
        return content

    elif report_type == "donor":
        content = {
            "type": "donor",
            "sections": ["what_went_well", "who_benefited", "challenges", "outlook"],
            "people_reached": kpis["mchp_cases"] + kpis["ambulance_trips"] + kpis["sensitization_participants"],
        }
        if settings.enable_bedrock:
            try:
                content["narrative"] = invoke_model(
                    f"""Write a 600-word donor impact narrative for Doctors for Madagascar.
Data: {kpis['mchp_cases']} patients supported financially, {kpis['mchp_catastrophic_avoided']} catastrophic expenses avoided, {kpis['ambulance_trips']} emergency transports ({kpis['ambulance_cured_rate']:.0f}% positive outcomes), {kpis['tb_positive']} TB cases found and {kpis['tb_treatment_starts']} started treatment, {kpis['workers_active']} community health workers active, {kpis['sensitization_participants']} people reached through outreach.

Structure with markdown headers:
## What Your Support Enabled
## Who Benefited  
## Challenges We Are Managing
## Why Continued Support Matters

Be warm, credible, specific with numbers. Do not invent stories or quotes.""",
                    role="report", max_tokens=3000, temperature=0.3
                )
            except Exception:
                pass
        return content

    else:  # portfolio_review
        content = {
            "type": "portfolio_review",
            "sections": ["portfolio_themes", "cross_project_learning", "strategic_progress", "achievements", "gaps", "outlook"],
        }
        if settings.enable_bedrock:
            try:
                content["narrative"] = invoke_model(
                    f"""Write a comprehensive 1000-word Annual Portfolio Review narrative for Doctors for Madagascar senior leadership.

Portfolio data:
- 5 active projects: Patient Support, Ambulance, TB, Community Workers, Sensitization
- Patient Support: {kpis['mchp_cases']} cases, {kpis['mchp_sites']} sites, DfM covers {kpis['mchp_dfm_share']:.1f}% of costs, {kpis['mchp_catastrophic_avoided']} catastrophic expenses avoided
- Ambulance: {kpis['ambulance_trips']} trips, {kpis['ambulance_total_distance']:.0f} km, median response {kpis['ambulance_median_response']:.2f} hrs, {kpis['ambulance_cured_rate']:.1f}% cure rate
- TB: {kpis['tb_records']} journey records, {kpis['tb_positive']} positive cases, {kpis['tb_treatment_starts']} treatments, {kpis['tb_diagnostic_centers']} centers
- Community Workers: {kpis['workers_total']} total, {kpis['workers_active']} active ({kpis['workers_active_rate']:.0f}%), {kpis['workers_trained']} trained, {kpis['workers_bicycle']} with bicycles, {kpis['workers_financial']} with financial support
- Sensitization: {kpis['sensitization_activities']} activities, {kpis['sensitization_participants']} participants, {kpis['sensitization_referrals']} referrals
- Data: {kpis['confidence_rate']:.1f}% high confidence across {sum(kpis['confidence_counts'].values())} total records

Structure with these markdown headers:
## Portfolio Performance Overview
## Cross-Project Themes and Patterns
## Major Achievements
## Strategic Progress
## What We Learned
## Remaining Gaps and Challenges
## Priorities for Next Period
## Data Maturity and M&E

Be analytical. Connect metrics to strategic meaning. Identify program maturity indicators. Do not invent facts.""",
                    role="report", max_tokens=4000, temperature=0.3
                )
            except Exception:
                pass
        return content
