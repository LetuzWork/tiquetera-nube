from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, Request, Response

from app.api.container import Container
from app.api.deps import get_container, sesion_actual
from app.api.schemas import HorarioOut, LoginIn, MeOut
from app.domain.models import Usuario

router = APIRouter(prefix="/auth", tags=["auth"])


def _me(usuario: Usuario, expira: datetime, c: Container) -> MeOut:
    return MeOut(
        usuario=usuario.usuario,
        nombre=usuario.nombre,
        mail=usuario.mail,
        rol=usuario.rol,
        permisos=sorted(p.value for p in usuario.permisos),
        sesion_expira=expira,
        segundos_restantes=max(0, int((expira - c.clock.ahora()).total_seconds())),
    )


@router.get("/horario", response_model=HorarioOut)
def horario(c: Container = Depends(get_container)) -> HorarioOut:
    h = c.horario
    abierto = h.permitido()
    return HorarioOut(
        abierto=abierto,
        ahora=h.ahora_local(),
        inicio=h.inicio,
        fin=h.fin,
        dias=sorted(h.dias),
        zona=str(h.zona),
        cierre=h.cierre(),
        proxima_apertura=None if abierto else h.proxima_apertura(),
    )


@router.post("/login", response_model=MeOut)
def login(datos: LoginIn, request: Request, response: Response, c: Container = Depends(get_container)) -> MeOut:
    ip = request.client.host if request.client else None
    usuario = c.auth.iniciar_sesion(datos.usuario, datos.password, ip)
    sesion = c.tokens.emitir(usuario, c.horario.cierre())
    response.set_cookie(
        c.settings.cookie_name,
        sesion.token,
        max_age=max(1, int((sesion.expira - c.clock.ahora()).total_seconds())),
        httponly=True,
        secure=c.settings.cookie_secure,
        samesite="strict",
        path="/",
    )
    return _me(usuario, sesion.expira, c)


@router.post("/logout", status_code=204)
def logout(response: Response, c: Container = Depends(get_container)) -> Response:
    response.delete_cookie(c.settings.cookie_name, path="/", httponly=True, secure=c.settings.cookie_secure, samesite="strict")
    response.status_code = 204
    return response


@router.get("/me", response_model=MeOut)
def me(sesion: tuple[Usuario, datetime] = Depends(sesion_actual), c: Container = Depends(get_container)) -> MeOut:
    return _me(sesion[0], sesion[1], c)
