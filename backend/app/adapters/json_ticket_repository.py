from __future__ import annotations

import os
import shutil
import threading
from collections.abc import Callable
from pathlib import Path

from filelock import FileLock
from pydantic import BaseModel

from app.domain.errors import TicketNoEncontrado
from app.domain.models import Ticket


class _Archivo(BaseModel):
    version: int = 1
    secuencia: int = 0
    tickets: list[Ticket] = []


class JsonTicketRepository:
    def __init__(self, ruta: Path) -> None:
        self._ruta = ruta
        self._ruta.parent.mkdir(parents=True, exist_ok=True)
        self._lock_archivo = FileLock(str(ruta) + ".lock", timeout=10)
        self._lock_hilos = threading.RLock()

    def listar(self) -> list[Ticket]:
        with self._lock_hilos, self._lock_archivo:
            return list(self._leer().tickets)

    def obtener(self, numero: int) -> Ticket | None:
        return next((t for t in self.listar() if t.numero == numero), None)

    def crear(self, construir: Callable[[int], Ticket]) -> Ticket:
        with self._lock_hilos, self._lock_archivo:
            datos = self._leer()
            datos.secuencia += 1
            ticket = construir(datos.secuencia)
            datos.tickets.append(ticket)
            self._escribir(datos)
            return ticket

    def actualizar(self, numero: int, mutar: Callable[[Ticket], Ticket]) -> Ticket:
        with self._lock_hilos, self._lock_archivo:
            datos = self._leer()
            for i, actual in enumerate(datos.tickets):
                if actual.numero == numero:
                    nuevo = mutar(actual.model_copy(deep=True))
                    datos.tickets[i] = nuevo
                    self._escribir(datos)
                    return nuevo
            raise TicketNoEncontrado()

    def _leer(self) -> _Archivo:
        if not self._ruta.exists():
            return _Archivo()
        return _Archivo.model_validate_json(self._ruta.read_bytes())

    def _escribir(self, datos: _Archivo) -> None:
        temporal = self._ruta.with_suffix(self._ruta.suffix + ".tmp")
        with open(temporal, "w", encoding="utf-8") as f:
            f.write(datos.model_dump_json(indent=2, exclude={"tickets": {"__all__": {"id"}}}))
            f.flush()
            os.fsync(f.fileno())
        if self._ruta.exists():
            shutil.copy2(self._ruta, self._ruta.with_suffix(self._ruta.suffix + ".bak"))
        os.replace(temporal, self._ruta)
