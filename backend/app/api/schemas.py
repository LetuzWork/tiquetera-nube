from __future__ import annotations

from datetime import date, datetime, time
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, model_validator

from app.domain.enums import Categoria, Estado, Prioridad, Rol

NombreUsuario = Annotated[str, StringConstraints(strip_whitespace=True, pattern=r"^[A-Za-z0-9._-]{1,64}$")]
Titulo = Annotated[str, StringConstraints(strip_whitespace=True, min_length=5, max_length=120)]
Descripcion = Annotated[str, StringConstraints(strip_whitespace=True, min_length=10, max_length=5000)]
TextoComentario = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=2000)]


class Entrada(BaseModel):
    model_config = ConfigDict(extra="forbid")


class LoginIn(Entrada):
    usuario: NombreUsuario
    password: str = Field(min_length=1, max_length=256)


class NuevoTicketIn(Entrada):
    titulo: Titulo
    descripcion: Descripcion
    categoria: Categoria
    prioridad: Prioridad = Prioridad.MEDIA


class CambiosTicketIn(Entrada):
    titulo: Titulo | None = None
    descripcion: Descripcion | None = None
    categoria: Categoria | None = None
    prioridad: Prioridad | None = None

    @model_validator(mode="after")
    def _algun_cambio(self) -> CambiosTicketIn:
        if all(v is None for v in self.model_dump().values()):
            raise ValueError("Indicá al menos un campo a modificar")
        return self


class EstadoIn(Entrada):
    estado: Estado


class AsignacionIn(Entrada):
    responsable: NombreUsuario | None


class ComentarioIn(Entrada):
    texto: TextoComentario


class HorarioOut(BaseModel):
    abierto: bool
    ahora: datetime
    inicio: time
    fin: time
    dias: list[int]
    zona: str
    cierre: datetime | None
    proxima_apertura: datetime | None


class MeOut(BaseModel):
    usuario: str
    nombre: str
    mail: str | None
    rol: Rol
    permisos: list[str]
    sesion_expira: datetime
    segundos_restantes: int


class ComentarioOut(BaseModel):
    autor: str
    texto: str
    creado_en: datetime


class EventoOut(BaseModel):
    campo: str
    anterior: str | None
    nuevo: str | None
    autor: str
    fecha: datetime


class TicketOut(BaseModel):
    id: str
    numero: int
    titulo: str
    descripcion: str
    categoria: Categoria
    estado: Estado
    prioridad: Prioridad
    solicitante: str
    responsable: str | None
    creado_en: datetime
    actualizado_en: datetime
    comentarios: list[ComentarioOut]
    historial: list[EventoOut]
    acciones: list[Estado] = []


class TicketResumenOut(BaseModel):
    id: str
    numero: int
    titulo: str
    categoria: Categoria
    estado: Estado
    prioridad: Prioridad
    solicitante: str
    responsable: str | None
    creado_en: datetime
    actualizado_en: datetime
    comentarios: int


class PaginaTickets(BaseModel):
    items: list[TicketResumenOut]
    total: int
    pagina: int
    por_pagina: int


class PersonaOut(BaseModel):
    usuario: str
    nombre: str


class ResumenOut(BaseModel):
    total: int
    pendientes: int
    criticos_activos: int
    horas_promedio_resolucion: float | None
    por_estado: dict[str, int]
    por_prioridad: dict[str, int]
    por_categoria: dict[str, int]
    por_responsable: dict[str, int]
    por_dia: dict[str, int]


class FiltrosQuery(BaseModel):
    estado: Estado | None = None
    prioridad: Prioridad | None = None
    categoria: Categoria | None = None
    responsable: NombreUsuario | None = None
    q: Annotated[str, StringConstraints(max_length=100)] | None = None
    desde: date | None = None
    hasta: date | None = None
