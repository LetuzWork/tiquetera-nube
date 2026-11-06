from __future__ import annotations

from datetime import datetime


class ErrorDominio(Exception):
    codigo = "ERROR"
    estado_http = 400
    mensaje = "No se pudo completar la operación."

    def __init__(self, mensaje: str | None = None, **extra: object) -> None:
        self.detalle = mensaje or self.mensaje
        self.extra = extra
        super().__init__(self.detalle)


class CredencialesInvalidas(ErrorDominio):
    codigo = "CREDENCIALES_INVALIDAS"
    estado_http = 401
    mensaje = "Usuario o contraseña incorrectos."


class CuentaDeshabilitada(CredencialesInvalidas):
    pass


class SinRol(ErrorDominio):
    codigo = "SIN_ROL"
    estado_http = 403
    mensaje = "Tu cuenta no pertenece a ningún grupo habilitado para la Tiquetera."


class FueraDeHorario(ErrorDominio):
    codigo = "FUERA_DE_HORARIO"
    estado_http = 403
    mensaje = "Ventanilla cerrada: el acceso está fuera del horario permitido."

    def __init__(self, apertura: datetime) -> None:
        super().__init__(apertura=apertura.isoformat())


class AccesoBloqueado(ErrorDominio):
    codigo = "ACCESO_BLOQUEADO"
    estado_http = 429
    mensaje = "Demasiados intentos fallidos. Probá de nuevo más tarde."

    def __init__(self, hasta: datetime) -> None:
        super().__init__(hasta=hasta.isoformat())


class DirectorioNoDisponible(ErrorDominio):
    codigo = "DIRECTORIO_NO_DISPONIBLE"
    estado_http = 503
    mensaje = "No se pudo contactar al directorio. Intentá nuevamente."


class SesionInvalida(ErrorDominio):
    codigo = "SESION_INVALIDA"
    estado_http = 401
    mensaje = "La sesión no es válida o expiró."


class SesionFueraDeHorario(SesionInvalida):
    codigo = "SESION_FUERA_DE_HORARIO"
    mensaje = "La franja horaria cerró y la sesión caducó."


class PermisoDenegado(ErrorDominio):
    codigo = "PERMISO_DENEGADO"
    estado_http = 403
    mensaje = "No tenés permiso para esta acción."


class TicketNoEncontrado(ErrorDominio):
    codigo = "TICKET_NO_ENCONTRADO"
    estado_http = 404
    mensaje = "El ticket no existe."


class ResponsableInvalido(ErrorDominio):
    codigo = "RESPONSABLE_INVALIDO"
    estado_http = 422
    mensaje = "El responsable debe ser un Operador o Admin del directorio."


class TicketArchivado(ErrorDominio):
    codigo = "TICKET_ARCHIVADO"
    estado_http = 409
    mensaje = "El ticket está archivado y no admite cambios."


class TransicionInvalida(ErrorDominio):
    codigo = "TRANSICION_INVALIDA"
    estado_http = 409

    def __init__(self, actual: object, nuevo: object) -> None:
        super().__init__(f"No se puede pasar de {actual} a {nuevo}.", actual=str(actual), nuevo=str(nuevo))
