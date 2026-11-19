from __future__ import annotations

from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.adapters.memory_ticket_repository import MemoryTicketRepository
from app.adapters.mock_auth_provider import MockAuthProvider
from app.api.container import construir_container
from app.core.clock import FixedClock
from app.core.config import Settings
from app.main import create_app
from tests.conftest import CLAVE, JUEVES_15, ZONA

RUTA = "/api/demo/reloj"
NUEVO = {"titulo": "Monitor sin señal", "descripcion": "El monitor del puesto 4 no enciende.", "categoria": "Hardware"}


def local(hora: int, minuto: int = 0, dia: int = 5) -> datetime:
    return datetime(2026, 11, dia, hora, minuto, tzinfo=ZONA)


def instante(valor: str) -> datetime:
    return datetime.fromisoformat(valor)


@pytest.fixture
def settings(tmp_path: Path) -> Settings:
    return Settings(
        _env_file=None, app_env="development", demo_reloj=True, jwt_secret="x" * 40, data_dir=tmp_path, login_max_attempts=3
    )


def cliente_con(tmp_path: Path, reloj: FixedClock, proveedor: MockAuthProvider, **ajustes: object) -> TestClient:
    settings = Settings(_env_file=None, jwt_secret="x" * 40, data_dir=tmp_path, **ajustes)
    container = construir_container(settings, clock=reloj, proveedor=proveedor, repositorio=MemoryTicketRepository())
    return TestClient(create_app(settings, container))


def ajustar(cliente: TestClient, **cuerpo: object):
    return cliente.put(RUTA, json=cuerpo)


def test_activo_get_dice_la_hora_del_servidor_sin_simular(cliente_de) -> None:
    r = cliente_de().get(RUTA)
    assert r.status_code == 200
    assert r.json()["simulado"] is False
    assert instante(r.json()["ahora"]) == JUEVES_15


def test_activo_put_con_hora_ajusta_hoy_en_la_zona_y_responde_el_horario(cliente_de) -> None:
    c = cliente_de()
    r = ajustar(c, hora="17:55")
    assert r.status_code == 200
    cuerpo = r.json()
    assert instante(cuerpo["ahora"]) == local(17, 55)
    assert cuerpo["abierto"] is True
    assert instante(cuerpo["cierre"]) == local(18)
    assert cuerpo == c.get("/api/auth/horario").json()
    estado = c.get(RUTA).json()
    assert estado["simulado"] is True
    assert instante(estado["ahora"]) == local(17, 55)


def test_tras_ajustar_horario_y_login_usan_la_hora_nueva(cliente_de) -> None:
    c = cliente_de()
    ajustar(c, hora="19:30")
    horario = c.get("/api/auth/horario").json()
    assert horario["abierto"] is False
    assert instante(horario["ahora"]) == local(19, 30)
    assert instante(horario["proxima_apertura"]) == local(8, dia=6)
    r = c.post("/api/auth/login", json={"usuario": "u.admin", "password": CLAVE})
    assert (r.status_code, r.json()["codigo"]) == (403, "FUERA_DE_HORARIO")

    ajustar(c, hora="10:00")
    assert c.get("/api/auth/horario").json()["abierto"] is True
    r = c.post("/api/auth/login", json={"usuario": "u.admin", "password": CLAVE})
    assert r.status_code == 200
    assert instante(r.json()["sesion_expira"]) == local(11)
    ticket = c.post("/api/tickets", json=NUEVO).json()
    assert instante(ticket["creado_en"]) == local(10)


def test_la_hora_ajustada_avanza_con_el_reloj_de_base(cliente_de, reloj) -> None:
    c = cliente_de()
    ajustar(c, hora="10:00")
    reloj.avanzar(timedelta(minutes=30))
    assert instante(c.get("/api/auth/horario").json()["ahora"]) == local(10, 30)


def test_la_sesion_abierta_cae_al_pasar_a_la_noche(cliente_de) -> None:
    c = cliente_de("u.operador")
    assert c.get("/api/tickets").status_code == 200
    ajustar(c, hora="19:30")
    r = c.get("/api/tickets")
    assert (r.status_code, r.json()["codigo"]) == (401, "SESION_FUERA_DE_HORARIO")


def test_el_bloqueo_de_intentos_usa_la_hora_ajustada(cliente_de) -> None:
    c = cliente_de()
    for _ in range(3):
        c.post("/api/auth/login", json={"usuario": "u.admin", "password": "mala"})
    assert c.post("/api/auth/login", json={"usuario": "u.admin", "password": CLAVE}).status_code == 429
    ajustar(c, hora="15:11")
    assert c.post("/api/auth/login", json={"usuario": "u.admin", "password": CLAVE}).status_code == 200


def test_real_vuelve_a_la_hora_del_reloj_de_base(cliente_de, reloj) -> None:
    c = cliente_de()
    ajustar(c, hora="19:30")
    r = ajustar(c, real=True)
    assert r.status_code == 200
    assert instante(r.json()["ahora"]) == JUEVES_15
    assert r.json()["abierto"] is True
    reloj.avanzar(timedelta(minutes=5))
    estado = c.get(RUTA).json()
    assert estado["simulado"] is False
    assert instante(estado["ahora"]) == local(15, 5)


def test_arranca_con_clock_override_y_real_vuelve_a_la_hora_del_sistema(settings, proveedor) -> None:
    con_override = settings.model_copy(update={"clock_override": datetime(2026, 11, 5, 19, 30)})
    c = construir_container(con_override, proveedor=proveedor, repositorio=MemoryTicketRepository())
    assert c.reloj_demo is not None
    assert c.clock is c.reloj_demo
    assert c.reloj_demo.simulado is True
    assert abs(c.clock.ahora() - local(19, 30)) < timedelta(seconds=5)
    c.reloj_demo.real()
    assert c.reloj_demo.simulado is False
    assert abs(c.clock.ahora() - datetime.now(UTC)) < timedelta(seconds=5)


@pytest.mark.parametrize(
    "cuerpo",
    [
        {"hora": "25:00"},
        {"hora": "7"},
        {"hora": ""},
        {"hora": "7:30"},
        {"hora": "12:60"},
        {"hora": "10:00:00"},
        {"hora": "١٠:٠٠"},
        {"real": False},
        {},
        {"hora": "10:00", "real": True},
        {"hora": "10:00", "fecha": "2026-11-06"},
    ],
)
def test_hora_invalida_da_422_y_no_cambia_el_reloj(cliente_de, cuerpo) -> None:
    c = cliente_de()
    r = c.put(RUTA, json=cuerpo)
    assert (r.status_code, r.json()["codigo"]) == (422, "ENTRADA_INVALIDA")
    estado = c.get(RUTA).json()
    assert estado["simulado"] is False
    assert instante(estado["ahora"]) == JUEVES_15


def test_activo_el_cors_admite_put(cliente_de) -> None:
    r = cliente_de().options(RUTA, headers={"Origin": "http://localhost:5173", "Access-Control-Request-Method": "PUT"})
    assert r.status_code == 200
    assert "PUT" in r.headers["access-control-allow-methods"]


@pytest.mark.parametrize(
    "ajustes",
    [
        {"app_env": "development", "demo_reloj": False},
        {"app_env": "development"},
        {"app_env": "test", "demo_reloj": True},
    ],
)
def test_inactivo_los_endpoints_no_existen(tmp_path, reloj, proveedor, ajustes) -> None:
    c = cliente_con(tmp_path, reloj, proveedor, **ajustes)
    assert c.get(RUTA).status_code == 404
    assert c.put(RUTA, json={"hora": "19:30"}).status_code == 404
    assert c.get("/api/auth/horario").json()["abierto"] is True
    preflight = c.options(RUTA, headers={"Origin": "http://localhost:5173", "Access-Control-Request-Method": "PUT"})
    assert "PUT" not in preflight.headers.get("access-control-allow-methods", "")


def test_inactivo_el_contenedor_no_tiene_reloj_ajustable(tmp_path, reloj, proveedor) -> None:
    settings = Settings(_env_file=None, app_env="test", demo_reloj=True, jwt_secret="x" * 40, data_dir=tmp_path)
    c = construir_container(settings, clock=reloj, proveedor=proveedor, repositorio=MemoryTicketRepository())
    assert c.reloj_demo is None
    assert c.clock is reloj


def test_en_produccion_demo_reloj_no_arranca(monkeypatch) -> None:
    for nombre, valor in {
        "APP_ENV": "production",
        "AUTH_PROVIDER": "ldap",
        "COOKIE_SECURE": "true",
        "JWT_SECRET": "x" * 40,
        "CLOCK_OVERRIDE": "",
        "DEMO_RELOJ": "true",
    }.items():
        monkeypatch.setenv(nombre, valor)
    with pytest.raises(ValidationError, match="DEMO_RELOJ no está permitido en producción"):
        Settings(_env_file=None)
    monkeypatch.setenv("DEMO_RELOJ", "false")
    assert Settings(_env_file=None).app_env == "production"
