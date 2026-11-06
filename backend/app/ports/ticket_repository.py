from __future__ import annotations

from collections.abc import Callable
from typing import Protocol

from app.domain.models import Ticket


class TicketReader(Protocol):
    def listar(self) -> list[Ticket]: ...

    def obtener(self, numero: int) -> Ticket | None: ...


class TicketWriter(Protocol):
    def crear(self, construir: Callable[[int], Ticket]) -> Ticket: ...

    def actualizar(self, numero: int, mutar: Callable[[Ticket], Ticket]) -> Ticket: ...
