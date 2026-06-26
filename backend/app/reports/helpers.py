from datetime import datetime
from zoneinfo import ZoneInfo
import html
import re

from .constants import SECTION_MAP


IST = ZoneInfo("Asia/Kolkata")


def now_ist():
    return datetime.now(IST)


def current_date():
    return now_ist().strftime("%d-%m-%Y")


def current_time():
    return now_ist().strftime("%I:%M %p")


def current_datetime():
    return now_ist().strftime("%d-%m-%Y %I:%M %p")


def clean_text(text: str | None) -> str:
    if text is None:
        return ""
    text = html.unescape(text)
    text = text.replace("\r", "")
    text = re.sub(r"\n{3,}", "\n\n", text)
    text = re.sub(r"[ \t]+", " ", text)
    return text.strip()


def html_to_plain(html_content: str) -> str:
    if not html_content:
        return ""

    text = re.sub(r"<br\s*/?>", "\n", html_content, flags=re.I)
    text = re.sub(r"</p>", "\n", text, flags=re.I)
    text = re.sub(r"<[^>]+>", "", text)
    text = html.unescape(text)
    return clean_text(text)


def get_section_title(section_code: str) -> str:
    return SECTION_MAP.get(section_code, section_code)


def make_document_title(company: str, project: str, report_type: str) -> str:
    if report_type == "RAW":
        return f"{company} - {project}"

    if report_type == "WEEKLY":
        return f"Weekly Report - {company} - {project}"

    if report_type == "MONTHLY":
        return f"Monthly Report - {company} - {project}"

    return f"{company} - {project}"


def empty_if_none(value):
    return "" if value is None else value


def normalize_company(company: str) -> str:
    return clean_text(company)


def normalize_project(project: str) -> str:
    return clean_text(project)


def normalize_title(title: str) -> str:
    return clean_text(title)


def normalize_html(html_content: str) -> str:
    if not html_content:
        return "<p><br></p>"

    return html_content


def build_editor_document(
    title,
    company,
    project,
    html_content,
    owner,
    report_type,
    period_start,
    period_end,
):
    return {
        "title": normalize_title(title),
        "company": normalize_company(company),
        "project": normalize_project(project),
        "html_content": normalize_html(html_content),
        "plain_text": html_to_plain(html_content),
        "owner": owner,
        "report_type": report_type,
        "period_start": empty_if_none(period_start),
        "period_end": empty_if_none(period_end),
        "updated_on": current_datetime(),
    }