import html
import json
import re
import urllib.error
import urllib.request
from collections import defaultdict
from datetime import datetime
from typing import Iterable

from app.models import AITrainingDocument, DataSubmission

from .files import compact_text


OLLAMA_URL = "http://localhost:11434/api/generate"
DEFAULT_MODEL = "qwen2.5:3b"

NTPC_SECTIONS = [
    ("A", "JVs and Subsidiaries"),
    ("B", "Green Energy / Renewables"),
    ("C", "New Business Avenues"),
    ("D", "International Business"),
    ("E", "Commercial / Tender / Investment Updates"),
    ("F", "Key Issues Requiring Management Attention"),
]


def generate_grounded_report(
    report_type: str,
    title: str,
    submissions: Iterable[DataSubmission],
    training_docs: Iterable[AITrainingDocument],
    period_start: str | None = None,
    period_end: str | None = None,
    month: int | None = None,
    year: int | None = None,
    prefer_ollama: bool = True,
) -> dict:
    source_items = list(submissions)
    reference_items = list(training_docs)
    prompt = build_prompt(
        report_type=report_type,
        title=title,
        submissions=source_items,
        training_docs=reference_items,
        period_start=period_start,
        period_end=period_end,
        month=month,
        year=year,
    )

    if prefer_ollama:
        ai_text = try_ollama(prompt)
        if ai_text:
            return {
                "html": text_to_report_html(ai_text, title, report_type, period_start, period_end, month, year),
                "text": ai_text,
                "generation_mode": "Ollama grounded draft",
            }

    fallback_text = build_deterministic_report(
        report_type=report_type,
        title=title,
        submissions=source_items,
        training_docs=reference_items,
        period_start=period_start,
        period_end=period_end,
        month=month,
        year=year,
    )
    return {
        "html": text_to_report_html(fallback_text, title, report_type, period_start, period_end, month, year),
        "text": fallback_text,
        "generation_mode": "Rule-based grounded draft",
    }


def build_prompt(**kwargs) -> str:
    report_type = kwargs["report_type"].upper()
    title = kwargs["title"]
    submissions = kwargs["submissions"]
    training_docs = kwargs["training_docs"]

    sources = []
    for item in submissions:
        sources.append(
            f"Submission #{item.submission_id}\n"
            f"Company: {item.company or '-'}\nProject: {item.project or '-'}\n"
            f"Business avenue: {item.section_title or item.section_code or '-'}\n"
            f"Topic: {item.topic or '-'}\nSubtopic: {item.subtopic or '-'}\n"
            f"Source text: {compact_text(item.extracted_text or '', 2500)}"
        )

    references = []
    for item in training_docs[:8]:
        references.append(
            f"Reference #{item.training_id} ({item.category})\n"
            f"Title: {item.title}\n"
            f"Formatting/style sample: {compact_text(item.extracted_text or '', 1800)}"
        )

    return f"""
You are preparing an official NTPC Business Development {report_type} report.

Rules:
- Use only the supplied source data for facts.
- Do not invent dates, approvals, financial values, tender outcomes, companies, or project status.
- If a fact is unclear, write "Status update awaited" or keep the point general.
- Use concise official language, similar to NTPC internal reports.
- Group related items under structured section headings.
- Preserve the style of reference reports/templates where useful.
- Return report body only, with headings and bullet points.

Report title: {title}
Period: {kwargs.get("period_start") or ""} to {kwargs.get("period_end") or ""}
Month/Year: {kwargs.get("month") or ""}/{kwargs.get("year") or ""}

SOURCE DATA:
{chr(10).join(sources) or "No source submissions selected."}

STYLE AND KNOWLEDGE REFERENCES:
{chr(10).join(references) or "No training references available."}
""".strip()


def try_ollama(prompt: str) -> str | None:
    try:
        body = json.dumps({"model": DEFAULT_MODEL, "prompt": prompt, "stream": False}).encode("utf-8")
        request = urllib.request.Request(
            OLLAMA_URL,
            data=body,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(request, timeout=180) as response:
            data = json.loads(response.read().decode("utf-8"))
        text = data.get("response", "").strip()
        return text or None
    except (OSError, urllib.error.URLError, ValueError):
        return None


def build_deterministic_report(
    report_type: str,
    title: str,
    submissions: list[DataSubmission],
    training_docs: list[AITrainingDocument],
    period_start: str | None = None,
    period_end: str | None = None,
    month: int | None = None,
    year: int | None = None,
) -> str:
    lines = [title.upper(), report_subtitle(report_type, period_start, period_end, month, year), ""]
    lines.append("Executive Summary")
    if submissions:
        companies = sorted({s.company for s in submissions if s.company})
        projects = sorted({s.project for s in submissions if s.project})
        lines.append(
            f"- The report has been prepared from {len(submissions)} verified raw data submission(s)"
            f" covering {len(companies)} company record(s) and {len(projects)} project record(s)."
        )
        lines.append("- Key points below are source-grounded and should be reviewed by the concerned BD officer before final circulation.")
    else:
        lines.append("- No source submissions were selected. Status update awaited.")
    if training_docs:
        lines.append(f"- {len(training_docs)} approved reference/template document(s) were used for style guidance.")
    lines.append("")

    grouped: dict[str, list[DataSubmission]] = defaultdict(list)
    for item in submissions:
        key = item.section_title or item.section_code or item.topic or "Other Business Development Updates"
        grouped[key].append(item)

    for index, (code, section_title) in enumerate(NTPC_SECTIONS, start=1):
        matching = []
        for key, records in grouped.items():
            normalized = key.lower()
            if section_title.lower().split(" / ")[0] in normalized or code.lower() in normalized:
                matching.extend(records)

        if not matching and index <= len(grouped):
            key = list(grouped.keys())[index - 1]
            matching = grouped[key]
            section_title = key

        lines.append(f"{code}. {section_title}")
        if not matching:
            lines.append("- No major update reported during the period.")
            lines.append("")
            continue

        for record in matching:
            heading = " - ".join(part for part in [record.company, record.project, record.topic] if part)
            lines.append(f"{heading or 'Business Development Update'}")
            for point in extract_points(record.extracted_text or record.review_note or "", max_points=4):
                lines.append(f"- {point}")
            lines.append("")

    lines.append("Source Traceability")
    for record in submissions:
        lines.append(
            f"- Submission #{record.submission_id}: {record.data_title or record.file_name or 'Untitled'}"
            f" | {record.company or '-'} | {record.project or '-'}"
        )
    return "\n".join(lines).strip()


def extract_points(text: str, max_points: int = 5) -> list[str]:
    cleaned = re.sub(r"\s+", " ", text or "").strip()
    if not cleaned:
        return ["Status update awaited."]

    candidates = re.split(r"(?<=[.!?])\s+|[\n\r]+|(?:\s+-\s+)", cleaned)
    points = []
    for item in candidates:
        item = item.strip(" -:\t")
        if len(item) < 18:
            continue
        if item.lower().startswith("[uploaded file stored"):
            continue
        points.append(item[:420])
        if len(points) >= max_points:
            break
    return points or [cleaned[:420]]


def report_subtitle(report_type: str, start: str | None, end: str | None, month: int | None, year: int | None) -> str:
    if report_type.lower() == "monthly":
        month_name = datetime(2000, int(month or 1), 1).strftime("%B") if month else ""
        return f"Key Activities of Business Development - {month_name} {year or ''}".strip()
    if start or end:
        return f"Weekly BD Report: {start or '-'} to {end or '-'}"
    return "Business Development Report"


def text_to_report_html(
    text: str,
    title: str,
    report_type: str,
    period_start: str | None,
    period_end: str | None,
    month: int | None,
    year: int | None,
) -> str:
    lines = [line.rstrip() for line in (text or "").splitlines()]
    html_parts = [
        f'<div class="report-doc {html.escape(report_type.lower())}-doc">',
        f'<div class="report-title">{html.escape(title.upper())}</div>',
        f'<div class="report-subtitle">{html.escape(report_subtitle(report_type, period_start, period_end, month, year))}</div>',
    ]
    in_list = False
    for line in lines[2:] if len(lines) > 2 else lines:
        stripped = line.strip()
        if not stripped:
            if in_list:
                html_parts.append("</ul>")
                in_list = False
            continue
        if stripped.startswith("- "):
            if not in_list:
                html_parts.append('<ul class="report-bullets">')
                in_list = True
            html_parts.append(f"<li>{html.escape(stripped[2:])}</li>")
            continue
        if in_list:
            html_parts.append("</ul>")
            in_list = False
        if re.match(r"^[A-F]\.\s+", stripped) or stripped in {"Executive Summary", "Source Traceability"}:
            html_parts.append(f'<div class="report-section-title">{html.escape(stripped)}</div>')
        else:
            html_parts.append(f'<div class="report-block-heading">{html.escape(stripped)}</div>')
    if in_list:
        html_parts.append("</ul>")
    html_parts.append("</div>")
    return "\n".join(html_parts)
