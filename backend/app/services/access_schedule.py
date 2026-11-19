from __future__ import annotations

from datetime import datetime, time, timedelta
from zoneinfo import ZoneInfo

from app.core.clock import Clock


class AccessSchedulePolicy:
    def __init__(self, clock: Clock, zona: ZoneInfo, inicio: time, fin: time, dias: frozenset[int]) -> None:
        if inicio >= fin:
            raise ValueError("La franja debe empezar antes de terminar")
        self._clock = clock
        self.zona = zona
        self.inicio = inicio
        self.fin = fin
        self.dias = dias

    def ahora_local(self) -> datetime:
        return self._clock.ahora().astimezone(self.zona)

    def permitido(self) -> bool:
        local = self.ahora_local()
        return local.isoweekday() in self.dias and self.inicio <= local.time() < self.fin

    def cierre(self) -> datetime | None:
        if not self.permitido():
            return None
        return datetime.combine(self.ahora_local().date(), self.fin, tzinfo=self.zona)

    def proxima_apertura(self) -> datetime:
        local = self.ahora_local()
        for desplazamiento in range(8):
            dia = local.date() + timedelta(days=desplazamiento)
            candidato = datetime.combine(dia, self.inicio, tzinfo=self.zona)
            if dia.isoweekday() in self.dias and candidato > local:
                return candidato
        raise RuntimeError("No hay días habilitados en la franja")
