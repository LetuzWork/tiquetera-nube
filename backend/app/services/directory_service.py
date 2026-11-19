from __future__ import annotations

from app.domain.models import Persona
from app.domain.permissions import ROLES_RESPONSABLES
from app.ports.auth_provider import DirectorioGrupos
from app.services.role_mapper import MapeadorRoles


class DirectoryService:
    def __init__(self, directorio: DirectorioGrupos, mapeador: MapeadorRoles) -> None:
        self._directorio = directorio
        self._mapeador = mapeador

    def responsables(self) -> list[Persona]:
        return self._directorio.miembros_de(self._mapeador.grupos_de(ROLES_RESPONSABLES))

    def es_responsable(self, usuario: str) -> bool:
        return any(p.usuario.casefold() == usuario.casefold() for p in self.responsables())
