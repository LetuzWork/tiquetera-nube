from __future__ import annotations

from collections.abc import Iterable, Mapping

from app.domain.enums import Rol
from app.domain.permissions import PRECEDENCIA


def clave_grupo(grupo: str) -> str:
    primero = grupo.split(",", 1)[0]
    nombre = primero.split("=", 1)[1] if "=" in primero else primero
    return nombre.strip().casefold()


class MapeadorRoles:
    def __init__(self, grupo_por_rol: Mapping[Rol, str]) -> None:
        self._grupo_por_rol = {r: g for r, g in grupo_por_rol.items() if g}
        self._rol_por_clave = {clave_grupo(g): r for r, g in self._grupo_por_rol.items()}

    def resolver(self, grupos: Iterable[str]) -> Rol | None:
        roles = {self._rol_por_clave[k] for g in grupos if (k := clave_grupo(g)) in self._rol_por_clave}
        return next((r for r in PRECEDENCIA if r in roles), None)

    def grupos_de(self, roles: Iterable[Rol]) -> list[str]:
        return [self._grupo_por_rol[r] for r in roles if r in self._grupo_por_rol]
