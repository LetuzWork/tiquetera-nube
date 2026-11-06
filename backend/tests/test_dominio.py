from __future__ import annotations

from datetime import datetime, time, timedelta

import pytest

from app.adapters.csv_exporter import CsvExporter, sanear_celda
from app.adapters.json_ticket_repository import JsonTicketRepository
from app.core.clock import FixedClock
from app.domain.enums import Categoria, Estado, Rol
from app.domain.errors import AccesoBloqueado, TransicionInvalida
from app.domain.models import Ticket
from app.domain.transitions import validar_transicion
from app.services.access_schedule import AccessSchedulePolicy
from app.services.login_throttle import LoginThrottle
from app.services.role_mapper import MapeadorRoles
from tests.conftest import JUEVES_15, ZONA

LUN_A_VIE = frozenset({1, 2, 3, 4, 5})


def politica(instante: datetime) -> AccessSchedulePolicy:
    return AccessSchedulePolicy(FixedClock(instante), ZONA, time(8), time(18), LUN_A_VIE)


@pytest.mark.parametrize(
    ("instante", "esperado"),
    [
        (datetime(2026, 11, 5, 8, 0, tzinfo=ZONA), True),
        (datetime(2026, 11, 5, 17, 59, tzinfo=ZONA), True),
        (datetime(2026, 11, 5, 18, 0, tzinfo=ZONA), False),
        (datetime(2026, 11, 5, 7, 59, tzinfo=ZONA), False),
        (datetime(2026, 11, 7, 10, 0, tzinfo=ZONA), False),
    ],
)
def test_franja_horaria(instante: datetime, esperado: bool) -> None:
    assert politica(instante).permitido() is esperado


def test_proxima_apertura_salta_fin_de_semana() -> None:
    viernes_noche = datetime(2026, 11, 6, 19, 30, tzinfo=ZONA)
    assert politica(viernes_noche).proxima_apertura() == datetime(2026, 11, 9, 8, 0, tzinfo=ZONA)


def test_cierre_es_fin_de_franja_del_dia() -> None:
    assert politica(JUEVES_15).cierre() == datetime(2026, 11, 5, 18, 0, tzinfo=ZONA)


def test_transiciones() -> None:
    validar_transicion(Estado.ABIERTO, Estado.EN_PROGRESO, False)
    validar_transicion(Estado.RESUELTO, Estado.EN_PROGRESO, False)
    validar_transicion(Estado.CERRADO, Estado.EN_PROGRESO, True)
    with pytest.raises(TransicionInvalida):
        validar_transicion(Estado.ABIERTO, Estado.RESUELTO, False)
    with pytest.raises(TransicionInvalida):
        validar_transicion(Estado.CERRADO, Estado.EN_PROGRESO, False)


def test_mapeador_prefiere_mayor_privilegio_y_acepta_dn() -> None:
    m = MapeadorRoles({Rol.ADMIN: "CN=GG-TQ-Admin,OU=Grupos,DC=t", Rol.OPERADOR: "GG-TQ-Operador", Rol.USUARIO: "GG-TQ-Usuario"})
    assert m.resolver(["gg-tq-usuario", "CN=GG-TQ-Operador,OU=X"]) is Rol.OPERADOR
    assert m.resolver(["GG-TQ-Admin"]) is Rol.ADMIN
    assert m.resolver(["Domain Users"]) is None


def test_throttle_bloquea_y_libera() -> None:
    reloj = FixedClock(JUEVES_15)
    t = LoginThrottle(reloj, 2, timedelta(minutes=10))
    t.registrar_fallo("a")
    t.registrar_fallo("a")
    with pytest.raises(AccesoBloqueado):
        t.verificar("a")
    reloj.avanzar(timedelta(minutes=11))
    t.verificar("a")


def test_csv_neutraliza_formulas_y_usa_bom() -> None:
    assert sanear_celda('=HYPERLINK("x")') == '\'=HYPERLINK("x")'
    assert sanear_celda("-2+3") == "'-2+3"
    assert sanear_celda("normal") == "normal"
    contenido = CsvExporter(";").exportar(["a", "b"], [["=1+1", "x;y"]])
    assert contenido.startswith(b"\xef\xbb\xbf")
    assert contenido.decode("utf-8-sig").splitlines()[1] == '\'=1+1;"x;y"'


def test_repositorio_json_persiste_y_respalda(tmp_path) -> None:
    ruta = tmp_path / "tickets.json"
    repo = JsonTicketRepository(ruta)

    def nuevo(n: int) -> Ticket:
        return Ticket(
            numero=n,
            titulo="Titulo",
            descripcion="Descripcion larga",
            categoria=Categoria.RED,
            solicitante="u",
            creado_en=JUEVES_15,
            actualizado_en=JUEVES_15,
        )

    repo.crear(nuevo)
    repo.crear(nuevo)
    repo.actualizar(1, lambda t: t.model_copy(update={"titulo": "Cambiado"}))
    otro = JsonTicketRepository(ruta)
    assert [t.id for t in otro.listar()] == ["TQ-000001", "TQ-000002"]
    assert otro.obtener(1).titulo == "Cambiado"
    assert ruta.with_suffix(".json.bak").exists()
    assert otro.crear(nuevo).numero == 3
