from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

import pytest
from fastapi.testclient import TestClient

from app.adapters.memory_ticket_repository import MemoryTicketRepository
from app.adapters.mock_auth_provider import MockAuthProvider
from app.api.container import construir_container
from app.core.clock import FixedClock
from app.core.config import Settings
from app.main import create_app

ZONA = ZoneInfo("America/Argentina/Buenos_Aires")
JUEVES_15 = datetime(2026, 11, 5, 15, 0, tzinfo=ZONA)
CLAVE = "Lab-2026"

USUARIOS = [
    {"usuario": "u.admin", "password": CLAVE, "nombre": "Ana", "grupos": ["GG-TQ-Admin"]},
    {"usuario": "u.operador", "password": CLAVE, "nombre": "Omar", "grupos": ["GG-TQ-Operador"]},
    {"usuario": "u.usuario", "password": CLAVE, "nombre": "Ursula", "grupos": ["GG-TQ-Usuario"]},
    {"usuario": "u.otro", "password": CLAVE, "nombre": "Otro", "grupos": ["GG-TQ-Usuario"]},
    {"usuario": "u.consulta", "password": CLAVE, "nombre": "Carlos", "grupos": ["GG-TQ-Consulta"]},
    {"usuario": "u.multi", "password": CLAVE, "nombre": "Mara", "grupos": ["CN=GG-TQ-Usuario,OU=G,DC=x", "GG-TQ-Operador"]},
    {"usuario": "u.sinrol", "password": CLAVE, "nombre": "Sergio", "grupos": []},
    {"usuario": "u.baja", "password": CLAVE, "nombre": "Diego", "grupos": ["GG-TQ-Usuario"], "deshabilitado": True},
]


@pytest.fixture
def settings(tmp_path: Path) -> Settings:
    return Settings(_env_file=None, app_env="test", jwt_secret="x" * 40, data_dir=tmp_path, login_max_attempts=3)


@pytest.fixture
def reloj() -> FixedClock:
    return FixedClock(JUEVES_15)


@pytest.fixture
def proveedor(tmp_path: Path) -> MockAuthProvider:
    ruta = tmp_path / "mock_users.json"
    ruta.write_text(json.dumps(USUARIOS), encoding="utf-8")
    return MockAuthProvider(ruta)


@pytest.fixture
def container(settings: Settings, reloj: FixedClock, proveedor: MockAuthProvider):
    return construir_container(settings, clock=reloj, proveedor=proveedor, repositorio=MemoryTicketRepository())


@pytest.fixture
def app(settings: Settings, container):
    return create_app(settings, container)


@pytest.fixture
def cliente_de(app):
    def crear(usuario: str | None = None) -> TestClient:
        cliente = TestClient(app)
        if usuario:
            r = cliente.post("/api/auth/login", json={"usuario": usuario, "password": CLAVE})
            assert r.status_code == 200, r.text
        return cliente

    return crear
