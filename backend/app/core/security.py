from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

import jwt

from app.core.clock import Clock
from app.domain.enums import Rol
from app.domain.errors import SesionInvalida
from app.domain.models import Usuario


@dataclass(frozen=True)
class SesionEmitida:
    token: str
    expira: datetime


class TokenService:
    def __init__(self, secreto: str, algoritmo: str, ttl: timedelta, clock: Clock) -> None:
        self._secreto = secreto
        self._algoritmo = algoritmo
        self._ttl = ttl
        self._clock = clock

    def emitir(self, usuario: Usuario, tope: datetime | None) -> SesionEmitida:
        ahora = self._clock.ahora()
        expira = ahora + self._ttl
        if tope is not None:
            expira = min(expira, tope.astimezone(UTC))
        claims = {
            "sub": usuario.usuario,
            "nombre": usuario.nombre,
            "mail": usuario.mail,
            "rol": usuario.rol.value,
            "iat": int(ahora.timestamp()),
            "exp": int(expira.timestamp()),
        }
        return SesionEmitida(jwt.encode(claims, self._secreto, algorithm=self._algoritmo), expira)

    def leer(self, token: str) -> tuple[Usuario, datetime]:
        try:
            claims = jwt.decode(
                token,
                self._secreto,
                algorithms=[self._algoritmo],
                options={"require": ["sub", "rol", "exp", "iat"], "verify_exp": False},
            )
            expira = datetime.fromtimestamp(claims["exp"], UTC)
            if expira <= self._clock.ahora():
                raise SesionInvalida()
            usuario = Usuario(
                usuario=claims["sub"],
                nombre=claims.get("nombre") or claims["sub"],
                mail=claims.get("mail"),
                rol=Rol(claims["rol"]),
            )
        except (jwt.InvalidTokenError, ValueError, KeyError) as e:
            raise SesionInvalida() from e
        return usuario, expira
