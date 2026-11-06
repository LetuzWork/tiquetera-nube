from __future__ import annotations

from collections.abc import Iterable
from typing import Protocol

from app.domain.models import IdentidadDirectorio, Persona


class Autenticador(Protocol):
    def autenticar(self, usuario: str, password: str) -> IdentidadDirectorio: ...


class DirectorioGrupos(Protocol):
    def miembros_de(self, grupos: Iterable[str]) -> list[Persona]: ...
