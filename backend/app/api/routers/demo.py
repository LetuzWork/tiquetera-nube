from __future__ import annotations

import logging
from datetime import datetime, time
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, StringConstraints, model_validator

from app.api.container import Container
from app.api.deps import get_container
from app.api.routers.auth import horario as horario_actual
from app.api.schemas import Entrada, HorarioOut
from app.core.clock import RelojAjustable

log = logging.getLogger(__name__)

router = APIRouter(prefix="/demo", tags=["demo"])

HoraDemo = Annotated[str, StringConstraints(pattern=r"^([01][0-9]|2[0-3]):[0-5][0-9]$")]


class HoraDemoIn(Entrada):
    hora: HoraDemo | None = None
    real: Literal[True] | None = None

    @model_validator(mode="after")
    def _una_sola_opcion(self) -> HoraDemoIn:
        if (self.hora is None) == (self.real is None):
            raise ValueError("Indicá una hora HH:MM o real: true")
        return self


class RelojDemoOut(BaseModel):
    simulado: bool
    ahora: datetime


def reloj_demo(c: Container = Depends(get_container)) -> RelojAjustable:
    if c.reloj_demo is None:
        raise HTTPException(status_code=404)
    return c.reloj_demo


@router.get("/reloj", response_model=RelojDemoOut)
def consultar(reloj: RelojAjustable = Depends(reloj_demo), c: Container = Depends(get_container)) -> RelojDemoOut:
    return RelojDemoOut(simulado=reloj.simulado, ahora=c.horario.ahora_local())


@router.put("/reloj", response_model=HorarioOut)
def ajustar(datos: HoraDemoIn, reloj: RelojAjustable = Depends(reloj_demo), c: Container = Depends(get_container)) -> HorarioOut:
    if datos.hora is None:
        reloj.real()
        log.warning("Reloj de demostración: vuelve a la hora del sistema")
    else:
        hoy = c.horario.ahora_local().date()
        reloj.ajustar(datetime.combine(hoy, time.fromisoformat(datos.hora), tzinfo=c.horario.zona))
        log.warning("Reloj de demostración ajustado a %s", c.horario.ahora_local().isoformat(timespec="minutes"))
    return horario_actual(c)
