from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime

from app.core.clock import Clock
from app.domain.enums import Categoria, Estado, Permiso, Prioridad
from app.domain.errors import PermisoDenegado, ResponsableInvalido, TicketArchivado, TicketNoEncontrado
from app.domain.models import Comentario, EventoHistorial, FiltroTickets, Ticket, Usuario
from app.domain.transitions import destinos_posibles, validar_transicion
from app.ports.ticket_repository import TicketReader, TicketWriter
from app.services.directory_service import DirectoryService


@dataclass(frozen=True)
class NuevoTicket:
    titulo: str
    descripcion: str
    categoria: Categoria
    prioridad: Prioridad


@dataclass(frozen=True)
class CambiosTicket:
    titulo: str | None = None
    descripcion: str | None = None
    categoria: Categoria | None = None
    prioridad: Prioridad | None = None


def _requerir(actor: Usuario, permiso: Permiso) -> None:
    if not actor.puede(permiso):
        raise PermisoDenegado()


class TicketService:
    def __init__(self, lector: TicketReader, escritor: TicketWriter, directorio: DirectoryService, clock: Clock) -> None:
        self._lector = lector
        self._escritor = escritor
        self._directorio = directorio
        self._clock = clock

    def listar(self, actor: Usuario, filtro: FiltroTickets) -> list[Ticket]:
        _requerir(actor, Permiso.TICKET_VER_PROPIOS)
        visibles = (t for t in self._lector.listar() if self._puede_ver(actor, t))
        return sorted((t for t in visibles if filtro.aplica(t)), key=lambda t: t.numero, reverse=True)

    def obtener(self, actor: Usuario, numero: int) -> Ticket:
        ticket = self._lector.obtener(numero)
        if ticket is None:
            raise TicketNoEncontrado()
        if not self._puede_ver(actor, ticket):
            raise PermisoDenegado("Solo podés ver los tickets que creaste.")
        return ticket

    def destinos(self, actor: Usuario, ticket: Ticket) -> list[Estado]:
        if not actor.puede(Permiso.TICKET_CAMBIAR_ESTADO):
            return []
        return sorted(destinos_posibles(ticket.estado, actor.puede(Permiso.TICKET_REABRIR_CERRADO)))

    def crear(self, actor: Usuario, datos: NuevoTicket) -> Ticket:
        _requerir(actor, Permiso.TICKET_CREAR)
        ahora = self._clock.ahora()

        def construir(numero: int) -> Ticket:
            return Ticket(
                numero=numero,
                titulo=datos.titulo,
                descripcion=datos.descripcion,
                categoria=datos.categoria,
                prioridad=datos.prioridad,
                solicitante=actor.usuario,
                creado_en=ahora,
                actualizado_en=ahora,
                historial=[self._evento("creacion", None, Estado.ABIERTO, actor, ahora)],
            )

        return self._escritor.crear(construir)

    def editar(self, actor: Usuario, numero: int, cambios: CambiosTicket) -> Ticket:
        _requerir(actor, Permiso.TICKET_EDITAR)
        self.obtener(actor, numero)

        def mutar(t: Ticket) -> Ticket:
            self._exigir_activo(t)
            ahora = self._clock.ahora()
            for campo in ("titulo", "descripcion", "categoria", "prioridad"):
                nuevo = getattr(cambios, campo)
                anterior = getattr(t, campo)
                if nuevo is not None and nuevo != anterior:
                    setattr(t, campo, nuevo)
                    t.historial.append(self._evento(campo, anterior, nuevo, actor, ahora))
                    t.actualizado_en = ahora
            return t

        return self._escritor.actualizar(numero, mutar)

    def cambiar_estado(self, actor: Usuario, numero: int, nuevo: Estado) -> Ticket:
        _requerir(actor, Permiso.TICKET_CAMBIAR_ESTADO)
        self.obtener(actor, numero)

        def mutar(t: Ticket) -> Ticket:
            validar_transicion(t.estado, nuevo, actor.puede(Permiso.TICKET_REABRIR_CERRADO))
            ahora = self._clock.ahora()
            t.historial.append(self._evento("estado", t.estado, nuevo, actor, ahora))
            t.estado = nuevo
            if nuevo is Estado.EN_PROGRESO and t.responsable is None and actor.puede(Permiso.TICKET_ASIGNAR):
                t.historial.append(self._evento("responsable", None, actor.usuario, actor, ahora))
                t.responsable = actor.usuario
            t.actualizado_en = ahora
            return t

        return self._escritor.actualizar(numero, mutar)

    def asignar(self, actor: Usuario, numero: int, responsable: str | None) -> Ticket:
        _requerir(actor, Permiso.TICKET_ASIGNAR)
        self.obtener(actor, numero)
        if responsable is not None and not self._directorio.es_responsable(responsable):
            raise ResponsableInvalido()

        def mutar(t: Ticket) -> Ticket:
            self._exigir_activo(t)
            if t.responsable == responsable:
                return t
            ahora = self._clock.ahora()
            t.historial.append(self._evento("responsable", t.responsable, responsable, actor, ahora))
            t.responsable = responsable
            t.actualizado_en = ahora
            return t

        return self._escritor.actualizar(numero, mutar)

    def comentar(self, actor: Usuario, numero: int, texto: str) -> Ticket:
        _requerir(actor, Permiso.TICKET_COMENTAR)
        self.obtener(actor, numero)

        def mutar(t: Ticket) -> Ticket:
            self._exigir_activo(t)
            ahora = self._clock.ahora()
            t.comentarios.append(Comentario(autor=actor.usuario, texto=texto, creado_en=ahora))
            t.historial.append(self._evento("comentario", None, f"#{len(t.comentarios)}", actor, ahora))
            t.actualizado_en = ahora
            return t

        return self._escritor.actualizar(numero, mutar)

    @staticmethod
    def _puede_ver(actor: Usuario, t: Ticket) -> bool:
        return actor.puede(Permiso.TICKET_VER_TODOS) or t.solicitante.casefold() == actor.usuario.casefold()

    @staticmethod
    def _exigir_activo(t: Ticket) -> None:
        if t.estado is Estado.CERRADO:
            raise TicketArchivado()

    @staticmethod
    def _evento(campo: str, anterior: object, nuevo: object, actor: Usuario, fecha: datetime) -> EventoHistorial:
        return EventoHistorial(
            campo=campo,
            anterior=None if anterior is None else str(anterior),
            nuevo=None if nuevo is None else str(nuevo),
            autor=actor.usuario,
            fecha=fecha,
        )
