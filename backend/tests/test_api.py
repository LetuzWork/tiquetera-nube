from __future__ import annotations

from datetime import datetime, timedelta

import pytest

from tests.conftest import CLAVE, ZONA

NUEVO = {
    "titulo": "Monitor sin señal",
    "descripcion": "El monitor del puesto 4 no enciende.",
    "categoria": "Hardware",
    "prioridad": "ALTA",
}


def crear_ticket(cliente, **extra) -> dict:
    r = cliente.post("/api/tickets", json={**NUEVO, **extra})
    assert r.status_code == 201, r.text
    return r.json()


def test_login_exitoso_setea_cookie_httponly(cliente_de) -> None:
    c = cliente_de()
    r = c.post("/api/auth/login", json={"usuario": "u.admin", "password": CLAVE})
    assert r.status_code == 200
    assert r.json()["rol"] == "admin"
    cookie = r.headers["set-cookie"].lower()
    assert "httponly" in cookie and "samesite=strict" in cookie
    assert c.get("/api/auth/me").json()["usuario"] == "u.admin"


def test_sesion_vence_al_cierre_de_franja(cliente_de) -> None:
    me = cliente_de("u.usuario").get("/api/auth/me").json()
    assert datetime.fromisoformat(me["sesion_expira"]) <= datetime(2026, 11, 5, 18, 0, tzinfo=ZONA)


@pytest.mark.parametrize(
    ("usuario", "password", "estado", "codigo"),
    [
        ("u.admin", "mala", 401, "CREDENCIALES_INVALIDAS"),
        ("u.baja", CLAVE, 401, "CREDENCIALES_INVALIDAS"),
        ("u.sinrol", CLAVE, 403, "SIN_ROL"),
        ("u.admin", "", 422, "ENTRADA_INVALIDA"),
        ("*)(objectClass=*", CLAVE, 422, "ENTRADA_INVALIDA"),
    ],
)
def test_login_rechazos(cliente_de, usuario, password, estado, codigo) -> None:
    r = cliente_de().post("/api/auth/login", json={"usuario": usuario, "password": password})
    assert (r.status_code, r.json()["codigo"]) == (estado, codigo)


def test_multirol_toma_mayor_privilegio(cliente_de) -> None:
    assert cliente_de("u.multi").get("/api/auth/me").json()["rol"] == "operador"


def test_login_fuera_de_horario(cliente_de, reloj) -> None:
    reloj.avanzar(timedelta(hours=4, minutes=30))
    r = cliente_de().post("/api/auth/login", json={"usuario": "u.admin", "password": CLAVE})
    assert r.status_code == 403
    assert r.json()["codigo"] == "FUERA_DE_HORARIO"
    assert r.json()["apertura"].startswith("2026-11-06T08:00")
    assert cliente_de().get("/api/auth/horario").json()["abierto"] is False


def test_sesion_activa_caduca_al_cerrar_la_franja(cliente_de, reloj) -> None:
    c = cliente_de("u.operador")
    reloj.avanzar(timedelta(hours=3, minutes=1))
    r = c.get("/api/tickets")
    assert (r.status_code, r.json()["codigo"]) == (401, "SESION_FUERA_DE_HORARIO")


def test_bloqueo_por_intentos(cliente_de) -> None:
    c = cliente_de()
    for _ in range(3):
        c.post("/api/auth/login", json={"usuario": "u.admin", "password": "mala"})
    r = c.post("/api/auth/login", json={"usuario": "u.admin", "password": CLAVE})
    assert r.status_code == 429


def test_rechaza_mutaciones_sin_json(cliente_de) -> None:
    r = cliente_de("u.usuario").post(
        "/api/tickets", data="titulo=x", headers={"content-type": "application/x-www-form-urlencoded"}
    )
    assert r.status_code == 415


def test_usuario_ve_solo_sus_tickets(cliente_de) -> None:
    propio = crear_ticket(cliente_de("u.usuario"))
    ajeno = crear_ticket(cliente_de("u.otro"))
    c = cliente_de("u.usuario")
    ids = [t["id"] for t in c.get("/api/tickets").json()["items"]]
    assert ids == [propio["id"]]
    assert c.get(f"/api/tickets/{ajeno['numero']}").status_code == 403


@pytest.mark.parametrize(
    ("usuario", "crear", "cambiar_estado", "asignar", "reportes"),
    [
        ("u.admin", 201, 200, 200, 200),
        ("u.operador", 201, 200, 200, 200),
        ("u.usuario", 201, 403, 403, 403),
        ("u.consulta", 403, 403, 403, 200),
    ],
)
def test_matriz_de_permisos(cliente_de, usuario, crear, cambiar_estado, asignar, reportes) -> None:
    numero = crear_ticket(cliente_de("u.otro"))["numero"]
    c = cliente_de(usuario)
    assert c.post("/api/tickets", json=NUEVO).status_code == crear
    if usuario != "u.usuario":
        assert c.post(f"/api/tickets/{numero}/estado", json={"estado": "EN_PROGRESO"}).status_code == cambiar_estado
        assert c.post(f"/api/tickets/{numero}/asignacion", json={"responsable": "u.admin"}).status_code == asignar
    assert c.get("/api/reportes/resumen").status_code == reportes
    assert c.get("/api/reportes/export/tickets.csv").status_code == reportes


def test_flujo_completo_con_historial(cliente_de) -> None:
    numero = crear_ticket(cliente_de("u.usuario"))["numero"]
    op = cliente_de("u.operador")
    t = op.post(f"/api/tickets/{numero}/estado", json={"estado": "EN_PROGRESO"}).json()
    assert t["responsable"] == "u.operador"
    assert set(t["acciones"]) == {"RESUELTO"}
    assert op.post(f"/api/tickets/{numero}/estado", json={"estado": "CERRADO"}).status_code == 409
    op.patch(f"/api/tickets/{numero}", json={"prioridad": "CRITICA"})
    op.post(f"/api/tickets/{numero}/comentarios", json={"texto": "Revisando cableado"})
    op.post(f"/api/tickets/{numero}/estado", json={"estado": "RESUELTO"})
    t = op.post(f"/api/tickets/{numero}/estado", json={"estado": "CERRADO"}).json()
    campos = [e["campo"] for e in t["historial"]]
    assert campos == ["creacion", "estado", "responsable", "prioridad", "comentario", "estado", "estado"]
    assert op.post(f"/api/tickets/{numero}/comentarios", json={"texto": "otro"}).status_code == 409
    admin = cliente_de("u.admin")
    assert admin.post(f"/api/tickets/{numero}/estado", json={"estado": "EN_PROGRESO"}).status_code == 200


def test_asignacion_solo_a_responsables_del_directorio(cliente_de) -> None:
    numero = crear_ticket(cliente_de("u.usuario"))["numero"]
    op = cliente_de("u.operador")
    assert (
        op.post(f"/api/tickets/{numero}/asignacion", json={"responsable": "u.usuario"}).json()["codigo"] == "RESPONSABLE_INVALIDO"
    )
    nombres = {p["usuario"] for p in op.get("/api/usuarios/responsables").json()}
    assert nombres == {"u.admin", "u.operador", "u.multi"}


def test_validacion_de_entrada(cliente_de) -> None:
    c = cliente_de("u.usuario")
    r = c.post("/api/tickets", json={**NUEVO, "titulo": "abc", "rol": "admin"})
    assert r.status_code == 422
    campos = {e["campo"] for e in r.json()["errores"]}
    assert {"titulo", "rol"} <= campos


def test_exportacion_csv(cliente_de) -> None:
    crear_ticket(cliente_de("u.usuario"), titulo="=CMD|'/c calc'!A1")
    r = cliente_de("u.consulta").get("/api/reportes/export/tickets.csv")
    assert r.status_code == 200
    assert "attachment" in r.headers["content-disposition"]
    lineas = r.content.decode("utf-8-sig").splitlines()
    assert lineas[0].startswith("id;titulo;categoria;estado")
    assert ";'=CMD" in lineas[1]
    historial = cliente_de("u.admin").get("/api/reportes/export/historial.csv")
    assert historial.content.decode("utf-8-sig").splitlines()[1].startswith("TQ-000001;")


def test_resumen(cliente_de) -> None:
    c = cliente_de("u.usuario")
    crear_ticket(c, prioridad="CRITICA")
    crear_ticket(c)
    r = cliente_de("u.consulta").get("/api/reportes/resumen").json()
    assert r["total"] == 2 and r["pendientes"] == 2 and r["criticos_activos"] == 1
    assert r["por_estado"]["ABIERTO"] == 2
