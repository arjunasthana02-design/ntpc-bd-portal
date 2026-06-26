import requests

OLLAMA_URL = "http://localhost:11434/api/generate"

MODEL = "qwen2.5:3b"


def ask_ai(prompt):

    response = requests.post(
        OLLAMA_URL,
        json={
            "model": MODEL,
            "prompt": prompt,
            "stream": False,
        },
        timeout=300,
    )

    data = response.json()

    return data["response"]


def generate_weekly(company, project, data):

    prompt = f"""
You are an NTPC Business Development Officer.

Prepare a WEEKLY REPORT.

Company:
{company}

Project:
{project}

Data:
{data}

Use official NTPC language.

Return only report.
"""

    return ask_ai(prompt)


def generate_monthly(company, reports):

    prompt = f"""
Merge the following weekly reports into one MONTHLY REPORT.

Company:

{company}

Weekly Reports:

{reports}

Use official NTPC format.

Return only report.
"""

    return ask_ai(prompt)