"""Calendar-month reporting boundaries in the business timezone."""
from datetime import datetime
import re
from zoneinfo import ZoneInfo
from fastapi import HTTPException

COLOMBIA_TZ = ZoneInfo("America/Bogota")


def month_bounds(month: str | None = None) -> tuple[datetime, datetime]:
    value = month or datetime.now(COLOMBIA_TZ).strftime("%Y-%m")
    if not re.fullmatch(r"\d{4}-(0[1-9]|1[0-2])", value):
        raise HTTPException(status_code=400, detail="Selecciona un mes válido (AAAA-MM)")
    year, number = map(int, value.split("-"))
    if not 1 <= year <= 9998:
        raise HTTPException(status_code=400, detail="Año fuera de rango")
    start = datetime(year, number, 1, tzinfo=COLOMBIA_TZ)
    end = datetime(year + (number == 12), 1 if number == 12 else number + 1, 1, tzinfo=COLOMBIA_TZ)
    return start, end
