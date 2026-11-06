from __future__ import annotations

from fastapi import APIRouter, Depends

from app.api.container import Container
from app.api.deps import get_container, requiere
from app.api.schemas import PersonaOut
from app.domain.enums import Permiso
from app.domain.models import Usuario

router = APIRouter(prefix="/usuarios", tags=["usuarios"])


@router.get("/responsables", response_model=list[PersonaOut])
def responsables(
    _: Usuario = Depends(requiere(Permiso.TICKET_ASIGNAR)), c: Container = Depends(get_container)
) -> list[PersonaOut]:
    return [PersonaOut(usuario=p.usuario, nombre=p.nombre) for p in c.directorio.responsables()]
