from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Path, Query

from app.api.container import Container
from app.api.deps import get_container, usuario_actual
from app.api.filters import a_filtro
from app.api.schemas import (
    AsignacionIn,
    CambiosTicketIn,
    ComentarioIn,
    EstadoIn,
    FiltrosQuery,
    NuevoTicketIn,
    PaginaTickets,
    TicketOut,
    TicketResumenOut,
)
from app.domain.models import Ticket, Usuario
from app.services.ticket_service import CambiosTicket, NuevoTicket

router = APIRouter(prefix="/tickets", tags=["tickets"])

NumeroTicket = Annotated[int, Path(ge=1, le=999_999)]


def _detalle(t: Ticket, actor: Usuario, c: Container) -> TicketOut:
    return TicketOut.model_validate({**t.model_dump(), "acciones": c.tickets.destinos(actor, t)})


def _resumen(t: Ticket) -> TicketResumenOut:
    return TicketResumenOut.model_validate(
        {**t.model_dump(exclude={"comentarios", "historial"}), "comentarios": len(t.comentarios)}
    )


@router.get("", response_model=PaginaTickets)
def listar(
    filtros: Annotated[FiltrosQuery, Query()],
    pagina: Annotated[int, Query(ge=1)] = 1,
    por_pagina: Annotated[int, Query(ge=1, le=100)] = 25,
    actor: Usuario = Depends(usuario_actual),
    c: Container = Depends(get_container),
) -> PaginaTickets:
    tickets = c.tickets.listar(actor, a_filtro(filtros, c.horario.zona))
    inicio = (pagina - 1) * por_pagina
    return PaginaTickets(
        items=[_resumen(t) for t in tickets[inicio : inicio + por_pagina]],
        total=len(tickets),
        pagina=pagina,
        por_pagina=por_pagina,
    )


@router.post("", response_model=TicketOut, status_code=201)
def crear(datos: NuevoTicketIn, actor: Usuario = Depends(usuario_actual), c: Container = Depends(get_container)) -> TicketOut:
    t = c.tickets.crear(actor, NuevoTicket(**datos.model_dump()))
    return _detalle(t, actor, c)


@router.get("/{numero}", response_model=TicketOut)
def obtener(numero: NumeroTicket, actor: Usuario = Depends(usuario_actual), c: Container = Depends(get_container)) -> TicketOut:
    return _detalle(c.tickets.obtener(actor, numero), actor, c)


@router.patch("/{numero}", response_model=TicketOut)
def editar(
    numero: NumeroTicket, datos: CambiosTicketIn, actor: Usuario = Depends(usuario_actual), c: Container = Depends(get_container)
) -> TicketOut:
    return _detalle(c.tickets.editar(actor, numero, CambiosTicket(**datos.model_dump())), actor, c)


@router.post("/{numero}/estado", response_model=TicketOut)
def cambiar_estado(
    numero: NumeroTicket, datos: EstadoIn, actor: Usuario = Depends(usuario_actual), c: Container = Depends(get_container)
) -> TicketOut:
    return _detalle(c.tickets.cambiar_estado(actor, numero, datos.estado), actor, c)


@router.post("/{numero}/asignacion", response_model=TicketOut)
def asignar(
    numero: NumeroTicket, datos: AsignacionIn, actor: Usuario = Depends(usuario_actual), c: Container = Depends(get_container)
) -> TicketOut:
    return _detalle(c.tickets.asignar(actor, numero, datos.responsable), actor, c)


@router.post("/{numero}/comentarios", response_model=TicketOut, status_code=201)
def comentar(
    numero: NumeroTicket, datos: ComentarioIn, actor: Usuario = Depends(usuario_actual), c: Container = Depends(get_container)
) -> TicketOut:
    return _detalle(c.tickets.comentar(actor, numero, datos.texto), actor, c)
