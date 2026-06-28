"""Annual report generator - produces a PDF report from all CSV data following DfM format."""

from __future__ import annotations

import csv
import json
import logging
import statistics
from datetime import datetime
from pathlib import Path
from typing import Any

from fpdf import FPDF

from app.core.config import get_settings
from app.models.bedrock_client import invoke_model

logger = logging.getLogger(__name__)


def _load_csv(path: Path) -> list[dict[str, str]]:
    """Load a CSV file into a list of dicts."""
    if not path.exists():
        return []
    with open(path, "r", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def _safe_float(val: str) -> float | None:
    """Convert string to float, return None on failure."""
    try:
        return float(val)
    except (ValueError, TypeError):
        return None


def _count_where(rows: list[dict], col: str, values: list[str]) -> int:
    """Count rows where column value is in the given list (case-insensitive)."""
    values_lower = [v.lower() for v in values]
    return sum(1 for r in rows if r.get(col, "").strip().lower() in values_lower)


def compute_kpis(data_dir: Path) -> dict[str, Any]:
    """Compute all KPIs from the CSV files."""
    kpis: dict[str, Any] = {}

    # Load all CSVs
    catalog = _load_csv(data_dir / "reporting_catalog.csv")
    mchp = _load_csv(data_dir / "mchp_patient_support.csv")
    ambulance_trips = _load_csv(data_dir / "ambulance_trips.csv")
    ambulance_causes = _load_csv(data_dir / "ambulance_causes.csv")
    tb = _load_csv(data_dir / "tb_patient_journey.csv")
    workers = _load_csv(data_dir / "community_workers.csv")
    sensitization = _load_csv(data_dir / "sensitization_activities.csv")

    # Source coverage
    kpis["source_coverage"] = []
    for entry in catalog:
        kpis["source_coverage"].append({
            "table": entry.get("table_name", ""),
            "rows": entry.get("row_count", ""),
            "columns": entry.get("column_count", ""),
            "domain": entry.get("domain", ""),
            "grain": entry.get("grain", ""),
        })

    # Detect latest year
    all_years = set()
    for dataset in [mchp, ambulance_trips, tb, workers, sensitization]:
        for row in dataset:
            y = row.get("year", "").strip()
            if y:
                all_years.add(y)
    latest_year = max(all_years) if all_years else "unknown"
    kpis["reporting_year"] = latest_year

    # --- MCHP Patient Support ---
    mchp_year = [r for r in mchp if r.get("year", "").strip() == latest_year] if latest_year != "unknown" else mchp
    kpis["mchp_cases"] = len(mchp_year)
    dfm_amounts = [_safe_float(r.get("dfm_amount", "")) for r in mchp_year]
    dfm_amounts_valid = [v for v in dfm_amounts if v is not None]
    kpis["mchp_dfm_total"] = sum(dfm_amounts_valid) if dfm_amounts_valid else 0
    invoice_amounts = [_safe_float(r.get("invoice_amount", "")) for r in mchp_year]
    invoice_valid = [v for v in invoice_amounts if v is not None and v > 0]
    kpis["mchp_dfm_share"] = (sum(dfm_amounts_valid) / sum(invoice_valid) * 100) if invoice_valid else 0
    kpis["mchp_catastrophic_avoided"] = _count_where(mchp_year, "catastrophic_expense_avoided", ["yes", "oui"])

    # Unique sites
    sites = set(r.get("site", "").strip() for r in mchp_year if r.get("site", "").strip())
    kpis["mchp_sites"] = len(sites)

    # --- Ambulance Trips ---
    amb_year = [r for r in ambulance_trips if r.get("year", "").strip() == latest_year] if latest_year != "unknown" else ambulance_trips
    kpis["ambulance_trips"] = len(amb_year)
    distances = [_safe_float(r.get("distance_km", "")) for r in amb_year]
    distances_valid = [v for v in distances if v is not None]
    kpis["ambulance_total_distance"] = sum(distances_valid) if distances_valid else 0
    response_times = [_safe_float(r.get("call_to_arrival_hours", "")) for r in amb_year]
    response_valid = [v for v in response_times if v is not None]
    kpis["ambulance_median_response"] = statistics.median(response_valid) if response_valid else 0
    kpis["ambulance_cured_rate"] = (
        _count_where(amb_year, "outcome", ["cured"]) / len(amb_year) * 100
    ) if amb_year else 0

    # Top causes
    cause_counts = {}
    for row in ambulance_causes:
        cause = row.get("cause", row.get("cause_category", "")).strip()
        count = _safe_float(row.get("case_count", "1")) or 1
        if cause:
            cause_counts[cause] = cause_counts.get(cause, 0) + count
    kpis["ambulance_top_causes"] = sorted(cause_counts.items(), key=lambda x: x[1], reverse=True)[:10]

    # --- TB Patient Journey ---
    tb_year = [r for r in tb if r.get("year", "").strip() == latest_year] if latest_year != "unknown" else tb
    kpis["tb_records"] = len(tb_year)
    kpis["tb_positive"] = _count_where(tb_year, "screening_result", ["tpb_positive", "tep"])
    kpis["tb_treatment_starts"] = sum(1 for r in tb_year if r.get("treatment_start_date", "").strip())
    # Diagnostic centers
    centers = set(r.get("diagnostic_center", "").strip() for r in tb_year if r.get("diagnostic_center", "").strip())
    kpis["tb_diagnostic_centers"] = len(centers)

    # --- Community Workers ---
    workers_year = [r for r in workers if r.get("year", "").strip() == latest_year] if latest_year != "unknown" else workers
    kpis["workers_total"] = len(workers_year)
    kpis["workers_active"] = _count_where(workers_year, "current_status", ["actif", "active"])
    kpis["workers_active_rate"] = (kpis["workers_active"] / kpis["workers_total"] * 100) if kpis["workers_total"] else 0
    kpis["workers_trained"] = _count_where(workers_year, "has_training", ["oui", "yes"])
    kpis["workers_materials"] = _count_where(workers_year, "has_materials", ["oui", "yes"])
    kpis["workers_financial"] = _count_where(workers_year, "has_financial_support", ["oui", "yes"])
    kpis["workers_bicycle"] = _count_where(workers_year, "has_bicycle", ["oui", "yes"])

    # --- Sensitization ---
    sens_year = [r for r in sensitization if r.get("year", "").strip() == latest_year] if latest_year != "unknown" else sensitization
    kpis["sensitization_activities"] = len(sens_year)
    participants = [_safe_float(r.get("total_participants", "")) for r in sens_year]
    participants_valid = [v for v in participants if v is not None]
    kpis["sensitization_participants"] = int(sum(participants_valid))
    referrals = [_safe_float(r.get("referrals_made", "")) for r in sens_year]
    referrals_valid = [v for v in referrals if v is not None]
    kpis["sensitization_referrals"] = int(sum(referrals_valid))

    # --- Data Quality ---
    all_data = mchp + ambulance_trips + tb + workers + sensitization
    confidence_counts = {"high": 0, "medium": 0, "low": 0}
    for row in all_data:
        marker = row.get("data_confidence_marker", "").strip().lower()
        if marker in confidence_counts:
            confidence_counts[marker] += 1
    kpis["confidence_counts"] = confidence_counts
    total_rows = sum(confidence_counts.values())
    kpis["confidence_rate"] = (confidence_counts["high"] / total_rows * 100) if total_rows else 0

    return kpis


def generate_narrative(kpis: dict[str, Any]) -> dict[str, str]:
    """Use LLM to generate narrative paragraphs for each section."""
    settings = get_settings()

    system = (
        "You are a report writer for Doctors for Madagascar (DfM) health program. "
        "Write concise annual-report paragraphs (150-250 words each) based on the provided KPIs. "
        "Use formal but accessible language. Include specific numbers. "
        "Do NOT invent data - only reference the numbers provided. "
        "Respond with JSON: {\"executive_summary\": \"...\", \"mchp\": \"...\", \"ambulance\": \"...\", "
        "\"tb\": \"...\", \"community\": \"...\", \"sensitization\": \"...\", \"data_quality\": \"...\"}"
    )

    prompt = f"""Generate annual report narratives for year {kpis['reporting_year']} based on these KPIs:

Patient Support: {kpis['mchp_cases']} cases, DfM covered {kpis['mchp_dfm_total']:.0f} (DfM share: {kpis['mchp_dfm_share']:.1f}%), catastrophic expenses avoided: {kpis['mchp_catastrophic_avoided']}, sites: {kpis['mchp_sites']}

Ambulance: {kpis['ambulance_trips']} trips, total distance {kpis['ambulance_total_distance']:.0f} km, median response {kpis['ambulance_median_response']:.2f} hours, cured rate: {kpis['ambulance_cured_rate']:.1f}%

TB: {kpis['tb_records']} journey records, {kpis['tb_positive']} positive cases, {kpis['tb_treatment_starts']} treatment starts, {kpis['tb_diagnostic_centers']} diagnostic centers

Community Workers: {kpis['workers_total']} total, {kpis['workers_active']} active ({kpis['workers_active_rate']:.0f}%), trained: {kpis['workers_trained']}, with materials: {kpis['workers_materials']}

Sensitization: {kpis['sensitization_activities']} activities, {kpis['sensitization_participants']} participants, {kpis['sensitization_referrals']} referrals

Data Quality: high confidence: {kpis['confidence_counts']['high']}, medium: {kpis['confidence_counts']['medium']}, low: {kpis['confidence_counts']['low']}, overall rate: {kpis['confidence_rate']:.1f}%"""

    try:
        response = invoke_model(prompt, role="report", system_prompt=system, max_tokens=3000, temperature=0.3)
        # Parse JSON
        clean = response.strip()
        if clean.startswith("```"):
            clean = clean.split("```")[1]
            if clean.startswith("json"):
                clean = clean[4:]
        return json.loads(clean)
    except Exception as e:
        logger.error(f"Narrative generation failed: {e}")
        return {
            "executive_summary": f"This report covers the {kpis['reporting_year']} reporting period.",
            "mchp": f"Patient support: {kpis['mchp_cases']} cases across {kpis['mchp_sites']} sites.",
            "ambulance": f"Ambulance services: {kpis['ambulance_trips']} trips covering {kpis['ambulance_total_distance']:.0f} km.",
            "tb": f"TB program: {kpis['tb_records']} journey records, {kpis['tb_positive']} positive cases.",
            "community": f"Community workers: {kpis['workers_active']} active of {kpis['workers_total']} total.",
            "sensitization": f"Sensitization: {kpis['sensitization_activities']} activities with {kpis['sensitization_participants']} participants.",
            "data_quality": f"Data confidence rate: {kpis['confidence_rate']:.1f}%.",
        }


def build_pdf(kpis: dict[str, Any], narratives: dict[str, str], output_path: Path) -> Path:
    """Build the PDF report."""
    pdf = FPDF()
    pdf.set_auto_page_break(auto=True, margin=20)

    year = kpis["reporting_year"]
    generated = datetime.now().strftime("%Y-%m-%d %H:%M")

    # --- Cover Page ---
    pdf.add_page()
    pdf.set_font("Helvetica", "B", 28)
    pdf.ln(40)
    pdf.cell(0, 15, "Doctors for Madagascar", new_x="LMARGIN", new_y="NEXT", align="C")
    pdf.set_font("Helvetica", "", 18)
    pdf.cell(0, 12, f"CSV-based Program Report {year}", new_x="LMARGIN", new_y="NEXT", align="C")
    pdf.ln(10)
    pdf.set_font("Helvetica", "I", 11)
    pdf.cell(0, 8, "CSV ONLY - NO PHOTOS", new_x="LMARGIN", new_y="NEXT", align="C")
    pdf.ln(20)

    # Headline KPIs on cover
    pdf.set_font("Helvetica", "B", 14)
    pdf.cell(0, 10, "Key Figures", new_x="LMARGIN", new_y="NEXT", align="C")
    pdf.set_font("Helvetica", "", 12)
    pdf.cell(0, 8, f"Patient Support Cases: {kpis['mchp_cases']}", new_x="LMARGIN", new_y="NEXT", align="C")
    pdf.cell(0, 8, f"Ambulance Trips: {kpis['ambulance_trips']}", new_x="LMARGIN", new_y="NEXT", align="C")
    pdf.cell(0, 8, f"TB Journey Records: {kpis['tb_records']}", new_x="LMARGIN", new_y="NEXT", align="C")

    pdf.ln(30)
    pdf.set_font("Helvetica", "I", 9)
    pdf.cell(0, 6, f"Generated: {generated}", new_x="LMARGIN", new_y="NEXT", align="C")
    pdf.cell(0, 6, f"Data boundary: local CSV files only", new_x="LMARGIN", new_y="NEXT", align="C")

    # --- Executive Summary ---
    pdf.add_page()
    _section_header(pdf, "Executive Summary")
    _write_paragraph(pdf, narratives.get("executive_summary", ""))
    pdf.ln(5)

    # Source coverage table
    _section_header(pdf, "Source Coverage", size=13)
    pdf.set_font("Helvetica", "B", 9)
    col_widths = [45, 20, 25, 35, 45]
    headers = ["Table", "Rows", "Columns", "Domain", "Grain"]
    for i, h in enumerate(headers):
        pdf.cell(col_widths[i], 7, h, border=1)
    pdf.ln()
    pdf.set_font("Helvetica", "", 9)
    for src in kpis["source_coverage"]:
        pdf.cell(col_widths[0], 6, str(src["table"])[:25], border=1)
        pdf.cell(col_widths[1], 6, str(src["rows"]), border=1)
        pdf.cell(col_widths[2], 6, str(src["columns"]), border=1)
        pdf.cell(col_widths[3], 6, str(src["domain"]), border=1)
        pdf.cell(col_widths[4], 6, str(src["grain"])[:25], border=1)
        pdf.ln()

    # --- Patient Support ---
    pdf.add_page()
    _section_header(pdf, "Financial Access and Patient Support")
    _write_paragraph(pdf, narratives.get("mchp", ""))
    pdf.ln(5)
    _kpi_row(pdf, [
        ("Cases", str(kpis["mchp_cases"])),
        ("Sites", str(kpis["mchp_sites"])),
        ("DfM Share", f"{kpis['mchp_dfm_share']:.1f}%"),
        ("Catastrophic Avoided", str(kpis["mchp_catastrophic_avoided"])),
    ])

    # --- Ambulance ---
    pdf.add_page()
    _section_header(pdf, "Ambulance and Emergency Referrals")
    _write_paragraph(pdf, narratives.get("ambulance", ""))
    pdf.ln(5)
    _kpi_row(pdf, [
        ("Trips", str(kpis["ambulance_trips"])),
        ("Total Distance", f"{kpis['ambulance_total_distance']:.0f} km"),
        ("Median Response", f"{kpis['ambulance_median_response']:.2f} hrs"),
        ("Cured Rate", f"{kpis['ambulance_cured_rate']:.1f}%"),
    ])

    # Top causes
    if kpis["ambulance_top_causes"]:
        pdf.ln(8)
        pdf.set_font("Helvetica", "B", 11)
        pdf.cell(0, 8, "Top Ambulance Causes", new_x="LMARGIN", new_y="NEXT")
        pdf.set_font("Helvetica", "", 9)
        for cause, count in kpis["ambulance_top_causes"][:7]:
            pdf.cell(0, 6, f"  - {cause}: {int(count)}", new_x="LMARGIN", new_y="NEXT")

    # --- TB ---
    pdf.add_page()
    _section_header(pdf, "Tuberculosis Patient Journey")
    _write_paragraph(pdf, narratives.get("tb", ""))
    pdf.ln(5)
    _kpi_row(pdf, [
        ("Journey Records", str(kpis["tb_records"])),
        ("Positive Cases", str(kpis["tb_positive"])),
        ("Treatment Starts", str(kpis["tb_treatment_starts"])),
        ("Diagnostic Centers", str(kpis["tb_diagnostic_centers"])),
    ])

    # --- Community Workers ---
    pdf.add_page()
    _section_header(pdf, "Community Health Workers")
    _write_paragraph(pdf, narratives.get("community", ""))
    pdf.ln(5)
    _kpi_row(pdf, [
        ("Total Workers", str(kpis["workers_total"])),
        ("Active", f"{kpis['workers_active']} ({kpis['workers_active_rate']:.0f}%)"),
        ("Trained", str(kpis["workers_trained"])),
        ("With Materials", str(kpis["workers_materials"])),
    ])

    # --- Sensitization ---
    pdf.add_page()
    _section_header(pdf, "Community Mobilization")
    _write_paragraph(pdf, narratives.get("sensitization", ""))
    pdf.ln(5)
    _kpi_row(pdf, [
        ("Activities", str(kpis["sensitization_activities"])),
        ("Participants", str(kpis["sensitization_participants"])),
        ("Referrals", str(kpis["sensitization_referrals"])),
    ])

    # --- Data Quality ---
    pdf.add_page()
    _section_header(pdf, "Data Quality and Audit Trail")
    _write_paragraph(pdf, narratives.get("data_quality", ""))
    pdf.ln(5)
    cc = kpis["confidence_counts"]
    _kpi_row(pdf, [
        ("High Confidence", str(cc["high"])),
        ("Medium", str(cc["medium"])),
        ("Low", str(cc["low"])),
        ("Confidence Rate", f"{kpis['confidence_rate']:.1f}%"),
    ])

    # --- Footer info ---
    pdf.ln(15)
    pdf.set_font("Helvetica", "I", 8)
    pdf.cell(0, 5, f"Report generated: {generated}", new_x="LMARGIN", new_y="NEXT")
    pdf.cell(0, 5, f"Reporting period filter: year = {year}", new_x="LMARGIN", new_y="NEXT")
    pdf.cell(0, 5, "Data source: local CSV files in data/reporting/", new_x="LMARGIN", new_y="NEXT")

    # Save
    pdf.output(str(output_path))
    return output_path


def _section_header(pdf: FPDF, title: str, size: int = 16):
    """Add a styled section header."""
    pdf.set_font("Helvetica", "B", size)
    pdf.set_text_color(0, 51, 102)
    pdf.cell(0, 12, title, new_x="LMARGIN", new_y="NEXT")
    pdf.set_text_color(0, 0, 0)
    pdf.ln(2)


def _write_paragraph(pdf: FPDF, text: str):
    """Write a multi-line paragraph."""
    pdf.set_font("Helvetica", "", 10)
    pdf.multi_cell(0, 6, text)


def _kpi_row(pdf: FPDF, kpis: list[tuple[str, str]]):
    """Render a row of KPI cards."""
    card_width = 45
    pdf.set_font("Helvetica", "B", 10)
    for label, value in kpis:
        pdf.cell(card_width, 8, value, border=1, align="C")
    pdf.ln()
    pdf.set_font("Helvetica", "", 8)
    for label, value in kpis:
        pdf.cell(card_width, 6, label, align="C")
    pdf.ln()


def generate_annual_report(year: str | None = None) -> Path:
    """Main entry point: compute KPIs, generate narratives, build PDF."""
    settings = get_settings()
    data_dir = Path(settings.data_dir)

    logger.info("Computing KPIs from CSV data...")
    kpis = compute_kpis(data_dir)

    if year:
        kpis["reporting_year"] = year

    logger.info(f"Generating narratives for year {kpis['reporting_year']}...")
    narratives = generate_narrative(kpis)

    output_dir = Path("output")
    output_dir.mkdir(exist_ok=True)
    date_str = datetime.now().strftime("%Y-%m-%d")
    output_path = output_dir / f"dfm_program_report_{date_str}.pdf"

    logger.info(f"Building PDF at {output_path}...")
    build_pdf(kpis, narratives, output_path)

    logger.info(f"Annual report generated: {output_path}")
    return output_path
