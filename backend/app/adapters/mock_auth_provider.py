from __future__ import annotations

import hmac
import json
from collections.abc import Iterable
from pathlib import Path

from pydantic import BaseModel, TypeAdapter

from app.domain.errors import CredencialesInvalidas, CuentaDeshabilitada
from app.domain.models import IdentidadDirectorio, Persona
from app.services.role_mapper import clave_grupo


class _UsuarioMock(BaseModel):
    usuario: str
    password: str
    nombre: str
    mail: str | None = None
    grupos: list[str] = []
    deshabilitado: bool = False


class MockAuthProvider:
    def __init__(self, ruta: Path) -> None:
        if not ruta.exists():
            raise FileNotFoundError(f"No existe {ruta}. Copiá mock_users.example.json a mock_users.json.")
        lista = TypeAdapter(list[_UsuarioMock]).validate_python(json.loads(ruta.read_text(encoding="utf-8")))
        self._usuarios = {u.usuario.casefold(): u for u in lista}

    def autenticar(self, usuario: str, password: str) -> IdentidadDirectorio:
        registro = self._usuarios.get(usuario.casefold())
        esperado = registro.password if registro else "-"
        coincide = hmac.compare_digest(password.encode(), esperado.encode())
        if registro is None or not password or not coincide:
            raise CredencialesInvalidas()
        if registro.deshabilitado:
            raise CuentaDeshabilitada()
        return IdentidadDirectorio(
            usuario=registro.usuario, nombre=registro.nombre, mail=registro.mail, grupos=frozenset(registro.grupos)
        )

    def miembros_de(self, grupos: Iterable[str]) -> list[Persona]:
        buscados = {clave_grupo(g) for g in grupos}
        return [
            Persona(usuario=u.usuario, nombre=u.nombre, mail=u.mail)
            for u in self._usuarios.values()
            if not u.deshabilitado and buscados & {clave_grupo(g) for g in u.grupos}
        ]
