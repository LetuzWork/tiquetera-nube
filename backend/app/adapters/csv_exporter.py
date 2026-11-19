from __future__ import annotations

import csv
import io
from collections.abc import Iterable, Sequence
from datetime import datetime
from enum import Enum

_PREFIJOS_FORMULA = ("=", "+", "-", "@", "\t", "\r")


class CsvExporter:
    media_type = "text/csv; charset=utf-8"
    extension = "csv"

    def __init__(self, delimitador: str = ";") -> None:
        self._delimitador = delimitador

    def exportar(self, encabezados: Sequence[str], filas: Iterable[Sequence[object]]) -> bytes:
        buffer = io.StringIO()
        escritor = csv.writer(buffer, delimiter=self._delimitador, quoting=csv.QUOTE_MINIMAL, lineterminator="\r\n")
        escritor.writerow([sanear_celda(e) for e in encabezados])
        for fila in filas:
            escritor.writerow([sanear_celda(v) for v in fila])
        return buffer.getvalue().encode("utf-8-sig")


def sanear_celda(valor: object) -> str:
    if valor is None:
        return ""
    if isinstance(valor, Enum):
        texto = str(valor.value)
    elif isinstance(valor, datetime):
        texto = valor.isoformat(timespec="seconds")
    else:
        texto = str(valor)
    if texto.startswith(_PREFIJOS_FORMULA):
        return "'" + texto
    return texto
