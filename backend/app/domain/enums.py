from __future__ import annotations

from enum import StrEnum


class Estado(StrEnum):
    ABIERTO = "ABIERTO"
    EN_PROGRESO = "EN_PROGRESO"
    RESUELTO = "RESUELTO"
    CERRADO = "CERRADO"


class Prioridad(StrEnum):
    BAJA = "BAJA"
    MEDIA = "MEDIA"
    ALTA = "ALTA"
    CRITICA = "CRITICA"


class Categoria(StrEnum):
    HARDWARE = "Hardware"
    SOFTWARE = "Software"
    RED = "Red"
    ACCESOS = "Accesos"
    OTRO = "Otro"


class Rol(StrEnum):
    ADMIN = "admin"
    OPERADOR = "operador"
    USUARIO = "usuario"
    CONSULTA = "consulta"


class Permiso(StrEnum):
    TICKET_CREAR = "ticket:crear"
    TICKET_VER_PROPIOS = "ticket:ver_propios"
    TICKET_VER_TODOS = "ticket:ver_todos"
    TICKET_EDITAR = "ticket:editar"
    TICKET_CAMBIAR_ESTADO = "ticket:cambiar_estado"
    TICKET_ASIGNAR = "ticket:asignar"
    TICKET_COMENTAR = "ticket:comentar"
    TICKET_REABRIR_CERRADO = "ticket:reabrir_cerrado"
    REPORTE_VER = "reporte:ver"
    REPORTE_EXPORTAR = "reporte:exportar"
