"""Annual report generator - produces a visually rich PDF report from all CSV data."""

from __future__ import annotations

import csv
import io
import json
import logging
import statistics
import tempfile
from collections import Counter
from datetime import datetime
from pathlib import Path
from typing import Any

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches

from fpdf import FPDF

from app.core.config import get_settings
from app.models.bedrock_client import invoke_model

logger = logging.getLogger(__name__)

# Color palette (DfM blue theme)
C_PRIMARY = (0, 51, 102)       # Dark blue
C_SECONDARY = (0, 102, 178)   # Medium blue
C_ACCENT = (0, 153, 204)      # Light blue
C_SUCCESS = (40, 167, 69)     # Green
C_WARNING = (255, 165, 0)     # Orange
C_DANGER = (220, 53, 69)      # Red
C_LIGHT = (240, 244, 248)     # Light gray-blue
C_WHITE = (255, 255, 255)

# Chart colors
CHART_COLORS = ["#003366", "#0066B2", "#0099CC", "#28A745", "#FFA500", "#DC3545", "#6F42C1", "#20C997"]


def _load_csv(path: Path) -> list[dict[str, str]]:
    if not path.exists():
        return []
    with open(path, "r", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def _safe_float(val: str) -> float | None:
    try:
        return float(val)
    except (ValueError, TypeError):
        return None


def _count_where(rows: list[dict], col: str, values: list[str]) -> int:
    values_lower = [v.lower() for v in values]
    return sum(1 for r in rows if r.get(col, "").strip().lower() in values_lower)


def _group_count(rows: list[dict], col: str, top_n: int = 10) -> list[tuple[str, int]]:
    """Group rows by column and return top N by count."""
    counter: Counter = Counter()
    for r in rows:
        val = r.get(col, "").strip()
        if val:
            counter[val] += 1
    return counter.most_common(top_n)


def _make_bar_chart(data: list[tuple[str, float]], title: str, xlabel: str = "", ylabel: str = "", horizontal: bool = True) -> bytes:
    """Generate a bar chart and return PNG bytes."""
    fig, ax = plt.subplots(figsize=(7, max(3, len(data) * 0.4)))
    labels = [d[0][:30] for d in data]
    values = [d[1] for d in data]
    colors = CHART_COLORS[:len(data)]

    if horizontal:
        ax.barh(labels, values, color=colors)
        ax.set_xlabel(ylabel)
        ax.invert_yaxis()
    else:
        ax.bar(labels, values, color=colors)
        ax.set_ylabel(ylabel)
        plt.xticks(rotation=45, ha="right")

    ax.set_title(title, fontsize=12, fontweight="bold", color="#003366")
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)
    plt.tight_layout()

    buf = io.BytesIO()
    fig.savefig(buf, format="png", dpi=150, bbox_inches="tight")
    plt.close(fig)
    buf.seek(0)
    return buf.read()


def _make_pie_chart(data: list[tuple[str, float]], title: str) -> bytes:
    """Generate a pie chart and return PNG bytes."""
    fig, ax = plt.subplots(figsize=(5, 5))
    labels = [d[0] for d in data]
    values = [d[1] for d in data]
    colors = CHART_COLORS[:len(data)]

    wedges, texts, autotexts = ax.pie(
        values, labels=labels, colors=colors, autopct="%1.1f%%",
        startangle=90, textprops={"fontsize": 9}
    )
    ax.set_title(title, fontsize=12, fontweight="bold", color="#003366")
    plt.tight_layout()

    buf = io.BytesIO()
    fig.savefig(buf, format="png", dpi=150, bbox_inches="tight")
    plt.close(fig)
    buf.seek(0)
    return buf.read()


def compute_kpis(data_dir: Path) -> dict[str, Any]:
    """Compute all KPIs and breakdowns from CSV files."""
    kpis: dict[str, Any] = {}

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
    sites = set(r.get("site", "").strip() for r in mchp_year if r.get("site", "").strip())
    kpis["mchp_sites"] = len(sites)
    # Breakdown by site
    kpis["mchp_by_site"] = _group_count(mchp_year, "site", 10)
    # Breakdown by support category
    kpis["mchp_by_category"] = _group_count(mchp_year, "support_category", 8)

    # --- Ambulance Trips ---
    amb_year = [r for r in ambulance_trips if r.get("year", "").strip() == latest_year] if latest_year != "unknown" else ambulance_trips
    kpis["ambulance_trips"] = len(amb_year)
    distances = [_safe_float(r.get("distance_km", "")) for r in amb_year]
    distances_valid = [v for v in distances if v is not None]
    kpis["ambulance_total_distance"] = sum(distances_valid) if distances_valid else 0
    response_times = [_safe_float(r.get("call_to_arrival_hours", "")) for r in amb_year]
    response_valid = [v for v in response_times if v is not None]
    kpis["ambulance_median_response"] = statistics.median(response_valid) if response_valid else 0
    kpis["ambulance_cured_rate"] = (_count_where(amb_year, "outcome", ["cured"]) / len(amb_year) * 100) if amb_year else 0
    # Top causes
    cause_counts = {}
    for row in ambulance_causes:
        cause = row.get("cause", row.get("cause_category", "")).strip()
        count = _safe_float(row.get("case_count", "1")) or 1
        if cause:
            cause_counts[cause] = cause_counts.get(cause, 0) + count
    kpis["ambulance_top_causes"] = sorted(cause_counts.items(), key=lambda x: x[1], reverse=True)[:10]
    # Breakdown by site/district
    kpis["ambulance_by_site"] = _group_count(amb_year, "site", 10)
    # Outcomes breakdown
    kpis["ambulance_outcomes"] = _group_count(amb_year, "outcome", 8)

    # --- TB Patient Journey ---
    tb_year = [r for r in tb if r.get("year", "").strip() == latest_year] if latest_year != "unknown" else tb
    kpis["tb_records"] = len(tb_year)
    kpis["tb_positive"] = _count_where(tb_year, "screening_result", ["tpb_positive", "tep"])
    kpis["tb_treatment_starts"] = sum(1 for r in tb_year if r.get("treatment_start_date", "").strip())
    centers = set(r.get("diagnostic_center", "").strip() for r in tb_year if r.get("diagnostic_center", "").strip())
    kpis["tb_diagnostic_centers"] = len(centers)
    # Breakdown by screening result
    kpis["tb_by_result"] = _group_count(tb_year, "screening_result", 8)
    # Breakdown by center
    kpis["tb_by_center"] = _group_count(tb_year, "diagnostic_center", 10)

    # --- Community Workers ---
    workers_year = [r for r in workers if r.get("year", "").strip() == latest_year] if latest_year != "unknown" else workers
    kpis["workers_total"] = len(workers_year)
    kpis["workers_active"] = _count_where(workers_year, "current_status", ["actif", "active"])
    kpis["workers_active_rate"] = (kpis["workers_active"] / kpis["workers_total"] * 100) if kpis["workers_total"] else 0
    kpis["workers_trained"] = _count_where(workers_year, "has_training", ["oui", "yes"])
    kpis["workers_materials"] = _count_where(workers_year, "has_materials", ["oui", "yes"])
    kpis["workers_financial"] = _count_where(workers_year, "has_financial_support", ["oui", "yes"])
    kpis["workers_bicycle"] = _count_where(workers_year, "has_bicycle", ["oui", "yes"])
    # Breakdown by district
    kpis["workers_by_district"] = _group_count(workers_year, "district", 10)

    # --- Sensitization ---
    sens_year = [r for r in sensitization if r.get("year", "").strip() == latest_year] if latest_year != "unknown" else sensitization
    kpis["sensitization_activities"] = len(sens_year)
    participants = [_safe_float(r.get("total_participants", "")) for r in sens_year]
    participants_valid = [v for v in participants if v is not None]
    kpis["sensitization_participants"] = int(sum(participants_valid))
    referrals = [_safe_float(r.get("referrals_made", "")) for r in sens_year]
    referrals_valid = [v for v in referrals if v is not None]
    kpis["sensitization_referrals"] = int(sum(referrals_valid))
    kpis["sensitization_by_type"] = _group_count(sens_year, "activity_type", 8)

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
    # Per-table confidence
    kpis["confidence_by_table"] = {}
    for name, dataset in [("mchp_patient_support", mchp), ("ambulance_trips", ambulance_trips),
                          ("tb_patient_journey", tb), ("community_workers", workers),
                          ("sensitization_activities", sensitization)]:
        high = sum(1 for r in dataset if r.get("data_confidence_marker", "").strip().lower() == "high")
        kpis["confidence_by_table"][name] = (high / len(dataset) * 100) if dataset else 0

    return kpis


def generate_narrative(kpis: dict[str, Any]) -> dict[str, str]:
    """Use LLM to generate narrative paragraphs for each section."""
    system = (
        "You are a report writer for Doctors for Madagascar (DfM) health program. "
        "Write concise annual-report paragraphs (150-250 words each) based on the provided KPIs. "
        "Use formal but accessible language. Include specific numbers. "
        "Do NOT invent data - only reference the numbers provided. "
        "Respond with JSON: {\"executive_summary\": \"...\", \"mchp\": \"...\", \"ambulance\": \"...\", "
        "\"tb\": \"...\", \"community\": \"...\", \"sensitization\": \"...\", \"data_quality\": \"...\"}"
    )
    prompt = f"""Generate annual report narratives for year {kpis['reporting_year']} based on these KPIs:

Patient Support: {kpis['mchp_cases']} cases, DfM covered {kpis['mchp_dfm_total']:.0f} (share: {kpis['mchp_dfm_share']:.1f}%), catastrophic avoided: {kpis['mchp_catastrophic_avoided']}, sites: {kpis['mchp_sites']}
Ambulance: {kpis['ambulance_trips']} trips, distance {kpis['ambulance_total_distance']:.0f} km, median response {kpis['ambulance_median_response']:.2f} hrs, cured: {kpis['ambulance_cured_rate']:.1f}%
TB: {kpis['tb_records']} records, {kpis['tb_positive']} positive, {kpis['tb_treatment_starts']} treatments, {kpis['tb_diagnostic_centers']} centers
Workers: {kpis['workers_total']} total, {kpis['workers_active']} active ({kpis['workers_active_rate']:.0f}%), trained: {kpis['workers_trained']}, materials: {kpis['workers_materials']}
Sensitization: {kpis['sensitization_activities']} activities, {kpis['sensitization_participants']} participants, {kpis['sensitization_referrals']} referrals
Quality: high={kpis['confidence_counts']['high']}, medium={kpis['confidence_counts']['medium']}, low={kpis['confidence_counts']['low']}, rate={kpis['confidence_rate']:.1f}%"""

    try:
        response = invoke_model(prompt, role="report", system_prompt=system, max_tokens=3000, temperature=0.3)
        clean = response.strip()
        if clean.startswith("```"):
            clean = clean.split("```")[1]
            if clean.startswith("json"):
                clean = clean[4:]
        return json.loads(clean)
    except Exception as e:
        logger.error(f"Narrative generation failed: {e}")
        return {
            "executive_summary": f"This report covers the {kpis['reporting_year']} reporting period across all health program domains.",
            "mchp": f"Patient support recorded {kpis['mchp_cases']} cases across {kpis['mchp_sites']} sites.",
            "ambulance": f"Ambulance services completed {kpis['ambulance_trips']} trips covering {kpis['ambulance_total_distance']:.0f} km.",
            "tb": f"TB program tracked {kpis['tb_records']} journey records with {kpis['tb_positive']} positive cases.",
            "community": f"Community health workforce: {kpis['workers_active']} active of {kpis['workers_total']} total workers.",
            "sensitization": f"Sensitization: {kpis['sensitization_activities']} activities reaching {kpis['sensitization_participants']} participants.",
            "data_quality": f"Overall data confidence rate: {kpis['confidence_rate']:.1f}%.",
        }


def _generate_charts(kpis: dict[str, Any]) -> dict[str, bytes]:
    """Generate all charts as PNG bytes."""
    charts = {}

    # Ambulance causes bar chart
    if kpis.get("ambulance_top_causes"):
        charts["ambulance_causes"] = _make_bar_chart(
            kpis["ambulance_top_causes"][:8], "Top Ambulance Causes", ylabel="Cases"
        )

    # Ambulance outcomes pie chart
    if kpis.get("ambulance_outcomes"):
        charts["ambulance_outcomes"] = _make_pie_chart(
            kpis["ambulance_outcomes"][:6], "Ambulance Trip Outcomes"
        )

    # MCHP by site
    if kpis.get("mchp_by_site"):
        charts["mchp_sites"] = _make_bar_chart(
            kpis["mchp_by_site"][:8], "Patient Support Cases by Site", ylabel="Cases"
        )

    # MCHP by category pie
    if kpis.get("mchp_by_category"):
        charts["mchp_categories"] = _make_pie_chart(
            kpis["mchp_by_category"][:6], "Support Categories"
        )

    # TB by screening result
    if kpis.get("tb_by_result"):
        charts["tb_results"] = _make_bar_chart(
            kpis["tb_by_result"][:8], "TB Screening Results", ylabel="Count"
        )

    # TB by center
    if kpis.get("tb_by_center"):
        charts["tb_centers"] = _make_bar_chart(
            kpis["tb_by_center"][:8], "Cases by Diagnostic Center", ylabel="Count"
        )

    # Workers by district
    if kpis.get("workers_by_district"):
        charts["workers_district"] = _make_bar_chart(
            kpis["workers_by_district"][:8], "Community Workers by District", ylabel="Workers"
        )

    # Worker support indicators
    worker_support = [
        ("Trained", kpis.get("workers_trained", 0)),
        ("Materials", kpis.get("workers_materials", 0)),
        ("Financial", kpis.get("workers_financial", 0)),
        ("Bicycle", kpis.get("workers_bicycle", 0)),
    ]
    charts["workers_support"] = _make_bar_chart(worker_support, "CHW Support Indicators", ylabel="Workers", horizontal=False)

    # Sensitization by type
    if kpis.get("sensitization_by_type"):
        charts["sensitization_types"] = _make_pie_chart(
            kpis["sensitization_by_type"][:6], "Activity Types"
        )

    # Data quality confidence pie
    cc = kpis.get("confidence_counts", {})
    if any(cc.values()):
        quality_data = [("High", cc.get("high", 0)), ("Medium", cc.get("medium", 0)), ("Low", cc.get("low", 0))]
        quality_data = [(k, v) for k, v in quality_data if v > 0]
        charts["quality_pie"] = _make_pie_chart(quality_data, "Data Confidence Distribution")

    # Per-table confidence bar
    if kpis.get("confidence_by_table"):
        table_conf = [(k.replace("_", " ").title()[:20], v) for k, v in kpis["confidence_by_table"].items()]
        charts["quality_by_table"] = _make_bar_chart(table_conf, "High-Confidence Rate by Table (%)", ylabel="%")

    return charts


class ReportPDF(FPDF):
    """Custom PDF class with styled headers and footers."""

    def __init__(self, year: str):
        super().__init__()
        self.year = year
        self.set_auto_page_break(auto=True, margin=25)

    def header(self):
        if self.page_no() > 1:
            self.set_font("Helvetica", "I", 8)
            self.set_text_color(*C_SECONDARY)
            self.cell(0, 6, f"DfM Program Report {self.year}", align="L")
            self.cell(0, 6, f"Page {self.page_no()}", align="R", new_x="LMARGIN", new_y="NEXT")
            self.set_draw_color(*C_ACCENT)
            self.line(10, 14, 200, 14)
            self.ln(4)
            self.set_text_color(0, 0, 0)

    def section_header(self, title: str, size: int = 16):
        self.set_font("Helvetica", "B", size)
        self.set_text_color(*C_PRIMARY)
        self.set_fill_color(*C_LIGHT)
        self.cell(0, 12, f"  {title}", fill=True, new_x="LMARGIN", new_y="NEXT")
        self.set_text_color(0, 0, 0)
        self.ln(4)

    def kpi_card(self, x: float, y: float, w: float, h: float, value: str, label: str, color: tuple = C_PRIMARY):
        self.set_fill_color(*color)
        self.rect(x, y, w, h, "F")
        # Value in white
        self.set_xy(x, y + 4)
        self.set_font("Helvetica", "B", 16)
        self.set_text_color(*C_WHITE)
        self.cell(w, 10, value, align="C")
        # Label in white
        self.set_xy(x, y + 15)
        self.set_font("Helvetica", "", 8)
        self.cell(w, 6, label, align="C")
        self.set_text_color(0, 0, 0)

    def kpi_row(self, kpis: list[tuple[str, str, tuple]], y_offset: float | None = None):
        """Render a row of colored KPI cards."""
        if y_offset is None:
            y_offset = self.get_y()
        n = len(kpis)
        card_w = min(45, (190 - (n - 1) * 3) / n)
        start_x = 10
        for i, (value, label, color) in enumerate(kpis):
            x = start_x + i * (card_w + 3)
            self.kpi_card(x, y_offset, card_w, 25, value, label, color)
        self.set_y(y_offset + 30)

    def write_paragraph(self, text: str):
        self.set_font("Helvetica", "", 10)
        self.multi_cell(0, 5.5, text)
        self.ln(3)

    def add_chart(self, chart_bytes: bytes, w: int = 160):
        """Add a chart image to the PDF."""
        with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tmp:
            tmp.write(chart_bytes)
            tmp_path = tmp.name
        # Check if enough space on page
        if self.get_y() > 200:
            self.add_page()
        self.image(tmp_path, x=15, w=w)
        self.ln(5)
        import os
        os.unlink(tmp_path)


def build_pdf(kpis: dict[str, Any], narratives: dict[str, str], charts: dict[str, bytes], output_path: Path) -> Path:
    """Build the visually rich PDF report."""
    year = kpis["reporting_year"]
    generated = datetime.now().strftime("%Y-%m-%d %H:%M")
    pdf = ReportPDF(year)

    # === COVER PAGE ===
    pdf.add_page()
    pdf.set_font("Helvetica", "B", 32)
    pdf.ln(30)
    pdf.set_text_color(*C_PRIMARY)
    pdf.cell(0, 15, "Doctors for Madagascar", new_x="LMARGIN", new_y="NEXT", align="C")
    pdf.set_font("Helvetica", "", 20)
    pdf.set_text_color(*C_SECONDARY)
    pdf.cell(0, 12, f"Program Report {year}", new_x="LMARGIN", new_y="NEXT", align="C")
    pdf.ln(5)
    pdf.set_font("Helvetica", "I", 10)
    pdf.set_text_color(100, 100, 100)
    pdf.cell(0, 8, "CSV-based Data Report | No Photos | Generated from Program Data", new_x="LMARGIN", new_y="NEXT", align="C")
    pdf.ln(15)

    # Cover KPI cards
    pdf.kpi_row([
        (str(kpis["mchp_cases"]), "Patient Cases", C_PRIMARY),
        (str(kpis["ambulance_trips"]), "Ambulance Trips", C_SECONDARY),
        (str(kpis["tb_records"]), "TB Records", C_ACCENT),
        (str(kpis["workers_active"]), "Active CHWs", C_SUCCESS),
    ])
    pdf.ln(10)
    pdf.kpi_row([
        (str(kpis["sensitization_participants"]), "Participants Reached", C_WARNING),
        (f"{kpis['ambulance_total_distance']:.0f} km", "Distance Covered", C_SECONDARY),
        (f"{kpis['confidence_rate']:.0f}%", "Data Confidence", C_SUCCESS),
    ])

    pdf.ln(20)
    pdf.set_font("Helvetica", "I", 9)
    pdf.set_text_color(100, 100, 100)
    pdf.cell(0, 6, f"Generated: {generated}", new_x="LMARGIN", new_y="NEXT", align="C")
    pdf.cell(0, 6, "Data source: Local CSV reporting files", new_x="LMARGIN", new_y="NEXT", align="C")
    pdf.set_text_color(0, 0, 0)

    # === EXECUTIVE SUMMARY ===
    pdf.add_page()
    pdf.section_header("Executive Summary")
    pdf.write_paragraph(narratives.get("executive_summary", ""))
    pdf.ln(5)

    # Source coverage table
    pdf.section_header("Source Coverage", size=13)
    pdf.set_font("Helvetica", "B", 8)
    col_w = [42, 18, 22, 32, 42]
    headers = ["Table", "Rows", "Columns", "Domain", "Grain"]
    pdf.set_fill_color(*C_PRIMARY)
    pdf.set_text_color(*C_WHITE)
    for i, h in enumerate(headers):
        pdf.cell(col_w[i], 7, h, border=1, fill=True, align="C")
    pdf.ln()
    pdf.set_text_color(0, 0, 0)
    pdf.set_font("Helvetica", "", 8)
    for j, src in enumerate(kpis["source_coverage"]):
        if j % 2 == 0:
            pdf.set_fill_color(*C_LIGHT)
        else:
            pdf.set_fill_color(*C_WHITE)
        pdf.cell(col_w[0], 6, str(src["table"])[:22], border=1, fill=True)
        pdf.cell(col_w[1], 6, str(src["rows"]), border=1, fill=True, align="C")
        pdf.cell(col_w[2], 6, str(src["columns"]), border=1, fill=True, align="C")
        pdf.cell(col_w[3], 6, str(src["domain"]), border=1, fill=True)
        pdf.cell(col_w[4], 6, str(src["grain"])[:22], border=1, fill=True)
        pdf.ln()

    # === PATIENT SUPPORT ===
    pdf.add_page()
    pdf.section_header("Financial Access and Patient Support")
    pdf.write_paragraph(narratives.get("mchp", ""))
    pdf.kpi_row([
        (str(kpis["mchp_cases"]), "Cases", C_PRIMARY),
        (str(kpis["mchp_sites"]), "Sites", C_SECONDARY),
        (f"{kpis['mchp_dfm_share']:.1f}%", "DfM Share", C_ACCENT),
        (str(kpis["mchp_catastrophic_avoided"]), "Catastrophic Avoided", C_SUCCESS),
    ])
    if "mchp_sites" in charts:
        pdf.add_chart(charts["mchp_sites"])
    if "mchp_categories" in charts:
        pdf.add_chart(charts["mchp_categories"], w=120)

    # === AMBULANCE ===
    pdf.add_page()
    pdf.section_header("Ambulance and Emergency Referrals")
    pdf.write_paragraph(narratives.get("ambulance", ""))
    pdf.kpi_row([
        (str(kpis["ambulance_trips"]), "Trips", C_PRIMARY),
        (f"{kpis['ambulance_total_distance']:.0f} km", "Total Distance", C_SECONDARY),
        (f"{kpis['ambulance_median_response']:.2f} hrs", "Median Response", C_ACCENT),
        (f"{kpis['ambulance_cured_rate']:.1f}%", "Cured Rate", C_SUCCESS),
    ])
    if "ambulance_causes" in charts:
        pdf.add_chart(charts["ambulance_causes"])
    if "ambulance_outcomes" in charts:
        pdf.add_chart(charts["ambulance_outcomes"], w=120)

    # === TB ===
    pdf.add_page()
    pdf.section_header("Tuberculosis Patient Journey")
    pdf.write_paragraph(narratives.get("tb", ""))
    pdf.kpi_row([
        (str(kpis["tb_records"]), "Journey Records", C_PRIMARY),
        (str(kpis["tb_positive"]), "Positive Cases", C_DANGER),
        (str(kpis["tb_treatment_starts"]), "Treatment Starts", C_SUCCESS),
        (str(kpis["tb_diagnostic_centers"]), "Centers", C_SECONDARY),
    ])
    if "tb_results" in charts:
        pdf.add_chart(charts["tb_results"])
    if "tb_centers" in charts:
        pdf.add_chart(charts["tb_centers"])

    # === COMMUNITY WORKERS ===
    pdf.add_page()
    pdf.section_header("Community Health Workers")
    pdf.write_paragraph(narratives.get("community", ""))
    pdf.kpi_row([
        (str(kpis["workers_total"]), "Total Workers", C_PRIMARY),
        (f"{kpis['workers_active']} ({kpis['workers_active_rate']:.0f}%)", "Active", C_SUCCESS),
        (str(kpis["workers_trained"]), "Trained", C_SECONDARY),
        (str(kpis["workers_materials"]), "With Materials", C_ACCENT),
    ])
    if "workers_district" in charts:
        pdf.add_chart(charts["workers_district"])
    if "workers_support" in charts:
        pdf.add_chart(charts["workers_support"], w=130)

    # === SENSITIZATION ===
    pdf.add_page()
    pdf.section_header("Community Mobilization")
    pdf.write_paragraph(narratives.get("sensitization", ""))
    pdf.kpi_row([
        (str(kpis["sensitization_activities"]), "Activities", C_PRIMARY),
        (str(kpis["sensitization_participants"]), "Participants", C_SECONDARY),
        (str(kpis["sensitization_referrals"]), "Referrals", C_SUCCESS),
    ])
    if "sensitization_types" in charts:
        pdf.add_chart(charts["sensitization_types"], w=120)

    # === DATA QUALITY ===
    pdf.add_page()
    pdf.section_header("Data Quality and Audit Trail")
    pdf.write_paragraph(narratives.get("data_quality", ""))
    cc = kpis["confidence_counts"]
    pdf.kpi_row([
        (str(cc["high"]), "High Confidence", C_SUCCESS),
        (str(cc["medium"]), "Medium", C_WARNING),
        (str(cc["low"]), "Low", C_DANGER),
        (f"{kpis['confidence_rate']:.1f}%", "Overall Rate", C_PRIMARY),
    ])
    if "quality_pie" in charts:
        pdf.add_chart(charts["quality_pie"], w=120)
    if "quality_by_table" in charts:
        pdf.add_chart(charts["quality_by_table"])

    # === APPENDIX ===
    pdf.add_page()
    pdf.section_header("Technical Appendix")
    pdf.set_font("Helvetica", "", 9)
    appendix_text = (
        f"Report generation: {generated}\n"
        f"Reporting period filter: year = {year}\n"
        f"Data source: Local CSV files in data/reporting/\n"
        f"LLM used for narratives: OpenAI gpt-4o-mini\n"
        f"CSV-only principle: No external data, images, or manual inputs.\n"
        f"Privacy: No row-level identifiers exposed (patient_key, worker_id, record_id filtered).\n"
        f"Aggregation: All KPIs are simple counts, sums, or medians from filtered rows.\n"
        f"Confidence: Rows tagged with data_confidence_marker (high/medium/low) from ETL pipeline."
    )
    pdf.multi_cell(0, 5, appendix_text)

    # Save
    pdf.output(str(output_path))
    return output_path


def generate_annual_report(year: str | None = None) -> Path:
    """Main entry point: compute KPIs, generate narratives and charts, build PDF."""
    settings = get_settings()
    data_dir = Path(settings.data_dir)

    logger.info("Computing KPIs from CSV data...")
    kpis = compute_kpis(data_dir)

    if year:
        kpis["reporting_year"] = year

    logger.info(f"Generating narratives for year {kpis['reporting_year']}...")
    narratives = generate_narrative(kpis)

    logger.info("Generating charts...")
    charts = _generate_charts(kpis)

    output_dir = Path("output")
    output_dir.mkdir(exist_ok=True)
    date_str = datetime.now().strftime("%Y-%m-%d")
    output_path = output_dir / f"dfm_program_report_{date_str}.pdf"

    logger.info(f"Building PDF at {output_path}...")
    build_pdf(kpis, narratives, charts, output_path)

    logger.info(f"Annual report generated: {output_path}")
    return output_path
