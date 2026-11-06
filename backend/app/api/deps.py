from __future__ import annotations

from collections.abc import Callable
from datetime import datetime

from fastapi import Depends, Request

from app.api.container import Container
from app.domain.enums import Permiso
from app.domain.errors import PermisoDenegado, SesionFueraDeHorario, SesionInvalida
from app.domain.models import Usuario


def get_container(request: Request) -> Container:
    return request.app.state.container


def sesion_actual(request: Request, c: Container = Depends(get_container)) -> tuple[Usuario, datetime]:
    token = request.cookies.get(c.settings.cookie_name)
    if not token:
        raise SesionInvalida()
    if not c.horario.permitido():
        raise SesionFueraDeHorario()
    return c.tokens.leer(token)


def usuario_actual(sesion: tuple[Usuario, datetime] = Depends(sesion_actual)) -> Usuario:
    return sesion[0]


def requiere(permiso: Permiso) -> Callable[[Usuario], Usuario]:
    def dependencia(usuario: Usuario = Depends(usuario_actual)) -> Usuario:
        if not usuario.puede(permiso):
            raise PermisoDenegado()
        return usuario

    return dependencia
