from __future__ import annotations

from collections import Counter
from collections.abc import Iterator, Sequence
from dataclasses import dataclass
from datetime import datetime
from statistics import mean
from zoneinfo import ZoneInfo

from app.domain.enums import Categoria, Estado, Permiso, Prioridad
from app.domain.errors import PermisoDenegado
from app.domain.models import FiltroTickets, Ticket, Usuario
from app.ports.ticket_repository import TicketReader

ENCABEZADOS_TICKETS = (
    "id",
    "titulo",
    "categoria",
    "estado",
    "prioridad",
    "solicitante",
    "responsable",
    "creado_en",
    "actualizado_en",
    "comentarios",
    "descripcion",
)
ENCABEZADOS_HISTORIAL = ("ticket", "fecha", "autor", "campo", "anterior", "nuevo")


@dataclass(frozen=True)
class Resumen:
    total: int
    pendientes: int
    criticos_activos: int
    horas_promedio_resolucion: float | None
    por_estado: dict[str, int]
    por_prioridad: dict[str, int]
    por_categoria: dict[str, int]
    por_responsable: dict[str, int]
    por_dia: dict[str, int]


class ReportService:
    def __init__(self, lector: TicketReader, zona: ZoneInfo) -> None:
        self._lector = lector
        self._zona = zona

    def resumen(self, actor: Usuario, filtro: FiltroTickets) -> Resumen:
        tickets = self._filtrados(actor, Permiso.REPORTE_VER, filtro)
        resoluciones = [h for t in tickets if (h := self._horas_resolucion(t)) is not None]
        return Resumen(
            total=len(tickets),
            pendientes=sum(t.estado in {Estado.ABIERTO, Estado.EN_PROGRESO} for t in tickets),
            criticos_activos=sum(t.prioridad is Prioridad.CRITICA and t.estado is not Estado.CERRADO for t in tickets),
            horas_promedio_resolucion=round(mean(resoluciones), 1) if resoluciones else None,
            por_estado=self._contar(tickets, lambda t: t.estado, list(Estado)),
            por_prioridad=self._contar(tickets, lambda t: t.prioridad, list(Prioridad)),
            por_categoria=self._contar(tickets, lambda t: t.categoria, list(Categoria)),
            por_responsable=dict(Counter(t.responsable or "sin asignar" for t in tickets).most_common()),
            por_dia=dict(sorted(Counter(t.creado_en.astimezone(self._zona).date().isoformat() for t in tickets).items())),
        )

    def filas_tickets(self, actor: Usuario, filtro: FiltroTickets) -> Iterator[Sequence[object]]:
        for t in self._filtrados(actor, Permiso.REPORTE_EXPORTAR, filtro):
            yield (
                t.id,
                t.titulo,
                t.categoria,
                t.estado,
                t.prioridad,
                t.solicitante,
                t.responsable,
                self._local(t.creado_en),
                self._local(t.actualizado_en),
                len(t.comentarios),
                t.descripcion,
            )

    def filas_historial(self, actor: Usuario, filtro: FiltroTickets) -> Iterator[Sequence[object]]:
        for t in self._filtrados(actor, Permiso.REPORTE_EXPORTAR, filtro):
            for e in t.historial:
                yield (t.id, self._local(e.fecha), e.autor, e.campo, e.anterior, e.nuevo)

    def _filtrados(self, actor: Usuario, permiso: Permiso, filtro: FiltroTickets) -> list[Ticket]:
        if not actor.puede(permiso):
            raise PermisoDenegado()
        return sorted((t for t in self._lector.listar() if filtro.aplica(t)), key=lambda t: t.numero)

    def _local(self, instante: datetime) -> datetime:
        return instante.astimezone(self._zona)

    @staticmethod
    def _contar(tickets: list[Ticket], clave, orden: list) -> dict[str, int]:
        conteo = Counter(clave(t) for t in tickets)
        return {str(k.value): conteo.get(k, 0) for k in orden}

    @staticmethod
    def _horas_resolucion(t: Ticket) -> float | None:
        resuelto = next((e.fecha for e in t.historial if e.campo == "estado" and e.nuevo == Estado.RESUELTO), None)
        if resuelto is None:
            return None
        return (resuelto - t.creado_en).total_seconds() / 3600
