from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime

from pydantic import BaseModel, ConfigDict, computed_field

from app.domain.enums import Categoria, Estado, Permiso, Prioridad, Rol
from app.domain.permissions import permisos_de


def formatear_id(numero: int) -> str:
    return f"TQ-{numero:06d}"


class Comentario(BaseModel):
    model_config = ConfigDict(frozen=True)

    autor: str
    texto: str
    creado_en: datetime


class EventoHistorial(BaseModel):
    model_config = ConfigDict(frozen=True)

    campo: str
    anterior: str | None
    nuevo: str | None
    autor: str
    fecha: datetime


class Ticket(BaseModel):
    numero: int
    titulo: str
    descripcion: str
    categoria: Categoria
    estado: Estado = Estado.ABIERTO
    prioridad: Prioridad = Prioridad.MEDIA
    solicitante: str
    responsable: str | None = None
    creado_en: datetime
    actualizado_en: datetime
    comentarios: list[Comentario] = []
    historial: list[EventoHistorial] = []

    @computed_field
    @property
    def id(self) -> str:
        return formatear_id(self.numero)


class Persona(BaseModel):
    model_config = ConfigDict(frozen=True)

    usuario: str
    nombre: str
    mail: str | None = None


class IdentidadDirectorio(BaseModel):
    model_config = ConfigDict(frozen=True)

    usuario: str
    nombre: str
    mail: str | None = None
    grupos: frozenset[str] = frozenset()


class Usuario(BaseModel):
    model_config = ConfigDict(frozen=True)

    usuario: str
    nombre: str
    mail: str | None = None
    rol: Rol

    @property
    def permisos(self) -> frozenset[Permiso]:
        return permisos_de(self.rol)

    def puede(self, permiso: Permiso) -> bool:
        return permiso in self.permisos


@dataclass(frozen=True)
class FiltroTickets:
    estado: Estado | None = None
    prioridad: Prioridad | None = None
    categoria: Categoria | None = None
    responsable: str | None = None
    solicitante: str | None = None
    texto: str | None = None
    desde: datetime | None = None
    hasta: datetime | None = None
    _texto_normalizado: str = field(init=False, default="")

    def __post_init__(self) -> None:
        object.__setattr__(self, "_texto_normalizado", (self.texto or "").strip().casefold())

    def aplica(self, t: Ticket) -> bool:
        if self.estado and t.estado is not self.estado:
            return False
        if self.prioridad and t.prioridad is not self.prioridad:
            return False
        if self.categoria and t.categoria is not self.categoria:
            return False
        if self.responsable and t.responsable != self.responsable:
            return False
        if self.solicitante and t.solicitante != self.solicitante:
            return False
        if self.desde and t.creado_en < self.desde:
            return False
        if self.hasta and t.creado_en > self.hasta:
            return False
        if self._texto_normalizado:
            pajar = f"{t.id} {t.titulo} {t.descripcion}".casefold()
            if self._texto_normalizado not in pajar:
                return False
        return True
