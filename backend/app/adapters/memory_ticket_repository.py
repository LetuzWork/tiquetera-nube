from __future__ import annotations

import threading
from collections.abc import Callable

from app.domain.errors import TicketNoEncontrado
from app.domain.models import Ticket


class MemoryTicketRepository:
    def __init__(self, tickets: list[Ticket] | None = None) -> None:
        self._tickets = {t.numero: t for t in tickets or []}
        self._secuencia = max(self._tickets, default=0)
        self._lock = threading.RLock()

    def listar(self) -> list[Ticket]:
        with self._lock:
            return list(self._tickets.values())

    def obtener(self, numero: int) -> Ticket | None:
        with self._lock:
            return self._tickets.get(numero)

    def crear(self, construir: Callable[[int], Ticket]) -> Ticket:
        with self._lock:
            self._secuencia += 1
            ticket = construir(self._secuencia)
            self._tickets[ticket.numero] = ticket
            return ticket

    def actualizar(self, numero: int, mutar: Callable[[Ticket], Ticket]) -> Ticket:
        with self._lock:
            if numero not in self._tickets:
                raise TicketNoEncontrado()
            nuevo = mutar(self._tickets[numero].model_copy(deep=True))
            self._tickets[numero] = nuevo
            return nuevo
