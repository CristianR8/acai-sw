"""Local Windows bridge for thermal printers used by the Docker backend."""

from __future__ import annotations

import hmac
import os

from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, Field

from .thermal_printer import print_thermal_text

app = FastAPI(title="ACAI PARK Print Agent", docs_url=None, redoc_url=None)


class PrintJob(BaseModel):
    text: str = Field(min_length=1, max_length=20_000)
    printer_hint: str = Field(min_length=1, max_length=256)
    copies: int = Field(default=1, ge=1, le=5)
    include_logo: bool = True


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/print")
def print_job(job: PrintJob, x_acai_print_token: str = Header(default="")) -> dict[str, str]:
    expected_token = os.getenv("PRINT_AGENT_TOKEN", "")
    if not expected_token or not hmac.compare_digest(x_acai_print_token, expected_token):
        raise HTTPException(status_code=401, detail="Token de impresión inválido")
    try:
        return print_thermal_text(text=job.text, printer_hint=job.printer_hint, copies=job.copies, include_logo=job.include_logo)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
