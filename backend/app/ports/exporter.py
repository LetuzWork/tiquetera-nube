from __future__ import annotations

from collections.abc import Iterable, Sequence
from typing import Protocol


class TabularExporter(Protocol):
    media_type: str
    extension: str

    def exportar(self, encabezados: Sequence[str], filas: Iterable[Sequence[object]]) -> bytes: ...
