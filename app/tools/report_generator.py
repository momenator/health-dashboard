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
    """Build project chapter summaries."""
    chapters = [
        {"id": "mchp_patient_support", "title": "Financial Access and Patient Support", "purpose": "Reduce financial barriers to healthcare for vulnerable populations.", "status": "active"},
        {"id": "ambulance_trips", "title": "Ambulance and Emergency Referrals", "purpose": "Provide emergency transport for patients who cannot reach health facilities.", "status": "active"},
        {"id": "tb_patient_journey", "title": "Tuberculosis Patient Journey", "purpose": "Screen, diagnose, and treat TB patients through community-based case finding.", "status": "active"},
        {"id": "community_workers", "title": "Community Health Workers", "purpose": "Deploy trained community agents to extend health service coverage.", "status": "active"},
        {"id": "sensitization_activities", "title": "Community Mobilization", "purpose": "Raise health awareness and generate referrals through community activities.", "status": "active"},
    ]
    if scope == "individual" and project:
        return [c for c in chapters if c["id"] == project]
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
        "internal": "Write for project managers. Focus on what needs attention, what is working, operational risks, and recommended actions. Be direct and specific.",
        "donor": "Write for donors/funders. Focus on impact, people reached, services delivered, challenges managed transparently. Be warm and credible.",
        "portfolio_review": "Write for senior leadership. Focus on cross-project performance, strategic progress, learning, and priorities for next period.",
    }.get(report_type, "")

    prompt = f"""Write a 200-word executive summary for a DfM health program report.

{audience_instruction}

Key metrics:
- Patient support: {kpis['mchp_cases']} cases, DfM covered {kpis['mchp_dfm_share']:.1f}% of costs
- Ambulance: {kpis['ambulance_trips']} trips, {kpis['ambulance_total_distance']:.0f} km, median response {kpis['ambulance_median_response']:.2f} hrs
- TB: {kpis['tb_records']} records, {kpis['tb_positive']} positive, {kpis['tb_treatment_starts']} treatments started
- Community workers: {kpis['workers_active']} active of {kpis['workers_total']}
- Sensitization: {kpis['sensitization_activities']} activities, {kpis['sensitization_participants']} participants
- Data confidence: {kpis['confidence_rate']:.1f}% high confidence

Do not invent facts. Be specific with numbers. Keep it to 200 words."""

    try:
        return invoke_model(prompt, role="report", max_tokens=1000, temperature=0.3)
    except Exception as e:
        logger.error(f"Executive summary generation failed: {e}")
        return "Executive summary generation failed. Please retry."


def _generate_insights(kpis: dict, report_type: str, scope: str, project: str | None) -> list[dict]:
    """Generate actionable insights."""
    settings = get_settings()
    if not settings.enable_bedrock:
        return [{"title": "Data available", "severity": "low", "evidence": "All tables loaded", "action": "Review metrics"}]

    prompt = f"""Based on these health program KPIs, generate 3-5 actionable insights as JSON array.

Metrics:
- Patient support: {kpis['mchp_cases']} cases across {kpis['mchp_sites']} sites
- Ambulance: {kpis['ambulance_trips']} trips, cure rate {kpis['ambulance_cured_rate']:.1f}%, median response {kpis['ambulance_median_response']:.2f} hrs
- TB: {kpis['tb_positive']} positive of {kpis['tb_records']} screened, {kpis['tb_treatment_starts']} started treatment
- Workers: {kpis['workers_active_rate']:.0f}% active, {kpis['workers_trained']} trained
- Sensitization: {kpis['sensitization_referrals']} referrals from {kpis['sensitization_activities']} activities

Each insight must have: title, severity (high/medium/low), evidence, possible_explanation, recommended_action, suggested_owner.
Do not invent data. Use cautious language for hypotheses.

Respond ONLY with a JSON array."""

    try:
        response = invoke_model(prompt, role="answer", max_tokens=2000, temperature=0.3)
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
    """Generate audience-specific section content."""
    settings = get_settings()

    if report_type == "internal":
        return {
            "type": "internal",
            "sections": ["management_actions", "data_issues", "operational_risks", "followup_questions"],
            "followup_questions": [
                "Which sites have the longest ambulance response times?",
                "How many TB patients started but didn't complete treatment?",
                "Which community workers haven't been supervised recently?",
                "What are the low-confidence records affecting?",
            ],
        }
    elif report_type == "donor":
        return {
            "type": "donor",
            "sections": ["what_went_well", "who_benefited", "challenges", "outlook"],
            "people_reached": kpis["mchp_cases"] + kpis["ambulance_trips"] + kpis["sensitization_participants"],
        }
    else:
        return {
            "type": "portfolio_review",
            "sections": ["portfolio_themes", "cross_project_learning", "strategic_progress", "outlook"],
        }
