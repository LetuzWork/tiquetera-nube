from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Protocol


class Clock(Protocol):
    def ahora(self) -> datetime: ...


class SystemClock:
    def ahora(self) -> datetime:
        return datetime.now(UTC)


class FixedClock:
    def __init__(self, instante: datetime) -> None:
        self._instante = _aware(instante)

    def ahora(self) -> datetime:
        return self._instante

    def avanzar(self, delta: timedelta) -> None:
        self._instante += delta


class OffsetClock:
    def __init__(self, inicio_simulado: datetime) -> None:
        self._desfase = _aware(inicio_simulado) - datetime.now(UTC)

    def ahora(self) -> datetime:
        return datetime.now(UTC) + self._desfase


def _aware(instante: datetime) -> datetime:
    if instante.tzinfo is None:
        raise ValueError("El instante debe incluir zona horaria")
    return instante.astimezone(UTC)
