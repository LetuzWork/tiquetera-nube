from __future__ import annotations

from datetime import datetime, time
from zoneinfo import ZoneInfo

from app.api.schemas import FiltrosQuery
from app.domain.models import FiltroTickets


def a_filtro(q: FiltrosQuery, zona: ZoneInfo, solicitante: str | None = None) -> FiltroTickets:
    return FiltroTickets(
        estado=q.estado,
        prioridad=q.prioridad,
        categoria=q.categoria,
        responsable=q.responsable,
        solicitante=solicitante,
        texto=q.q,
        desde=datetime.combine(q.desde, time.min, tzinfo=zona) if q.desde else None,
        hasta=datetime.combine(q.hasta, time.max, tzinfo=zona) if q.hasta else None,
    )
