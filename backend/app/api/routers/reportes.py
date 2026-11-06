from __future__ import annotations

from dataclasses import asdict
from typing import Annotated

from fastapi import APIRouter, Depends, Query, Response

from app.api.container import Container
from app.api.deps import get_container, requiere
from app.api.filters import a_filtro
from app.api.schemas import FiltrosQuery, ResumenOut
from app.domain.enums import Permiso
from app.domain.models import Usuario
from app.services.report_service import ENCABEZADOS_HISTORIAL, ENCABEZADOS_TICKETS

router = APIRouter(prefix="/reportes", tags=["reportes"])


@router.get("/resumen", response_model=ResumenOut)
def resumen(
    filtros: Annotated[FiltrosQuery, Query()],
    actor: Usuario = Depends(requiere(Permiso.REPORTE_VER)),
    c: Container = Depends(get_container),
) -> ResumenOut:
    return ResumenOut(**asdict(c.reportes.resumen(actor, a_filtro(filtros, c.horario.zona))))


def _archivo(c: Container, nombre: str, contenido: bytes) -> Response:
    sello = c.horario.ahora_local().strftime("%Y%m%d-%H%M")
    return Response(
        content=contenido,
        media_type=c.exportador.media_type,
        headers={"Content-Disposition": f'attachment; filename="{nombre}-{sello}.{c.exportador.extension}"'},
    )


@router.get("/export/tickets.csv")
def exportar_tickets(
    filtros: Annotated[FiltrosQuery, Query()],
    actor: Usuario = Depends(requiere(Permiso.REPORTE_EXPORTAR)),
    c: Container = Depends(get_container),
) -> Response:
    filas = c.reportes.filas_tickets(actor, a_filtro(filtros, c.horario.zona))
    return _archivo(c, "tickets", c.exportador.exportar(ENCABEZADOS_TICKETS, filas))


@router.get("/export/historial.csv")
def exportar_historial(
    filtros: Annotated[FiltrosQuery, Query()],
    actor: Usuario = Depends(requiere(Permiso.REPORTE_EXPORTAR)),
    c: Container = Depends(get_container),
) -> Response:
    filas = c.reportes.filas_historial(actor, a_filtro(filtros, c.horario.zona))
    return _archivo(c, "historial", c.exportador.exportar(ENCABEZADOS_HISTORIAL, filas))
