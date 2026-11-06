from __future__ import annotations

from app.domain.enums import Estado
from app.domain.errors import TransicionInvalida

TRANSICIONES: dict[Estado, frozenset[Estado]] = {
    Estado.ABIERTO: frozenset({Estado.EN_PROGRESO, Estado.CERRADO}),
    Estado.EN_PROGRESO: frozenset({Estado.RESUELTO}),
    Estado.RESUELTO: frozenset({Estado.CERRADO, Estado.EN_PROGRESO}),
    Estado.CERRADO: frozenset(),
}


def destinos_posibles(actual: Estado, puede_reabrir_cerrado: bool) -> frozenset[Estado]:
    if actual is Estado.CERRADO and puede_reabrir_cerrado:
        return frozenset({Estado.EN_PROGRESO})
    return TRANSICIONES[actual]


def validar_transicion(actual: Estado, nuevo: Estado, puede_reabrir_cerrado: bool) -> None:
    if nuevo not in destinos_posibles(actual, puede_reabrir_cerrado):
        raise TransicionInvalida(actual, nuevo)
