from __future__ import annotations

import threading
from collections import defaultdict
from datetime import datetime, timedelta

from app.core.clock import Clock
from app.domain.errors import AccesoBloqueado


class LoginThrottle:
    def __init__(self, clock: Clock, max_intentos: int, bloqueo: timedelta) -> None:
        self._clock = clock
        self._max = max_intentos
        self._bloqueo = bloqueo
        self._fallos: dict[str, list[datetime]] = defaultdict(list)
        self._lock = threading.Lock()

    def verificar(self, clave: str) -> None:
        with self._lock:
            recientes = self._recientes(clave)
            if len(recientes) >= self._max:
                raise AccesoBloqueado(recientes[-1] + self._bloqueo)

    def registrar_fallo(self, clave: str) -> None:
        with self._lock:
            self._recientes(clave).append(self._clock.ahora())

    def limpiar(self, clave: str) -> None:
        with self._lock:
            self._fallos.pop(clave, None)

    def _recientes(self, clave: str) -> list[datetime]:
        limite = self._clock.ahora() - self._bloqueo
        vigentes = [f for f in self._fallos[clave] if f > limite]
        self._fallos[clave] = vigentes
        return vigentes


def clave_intento(usuario: str, ip: str | None) -> str:
    return f"{usuario.casefold()}|{ip or '-'}"
