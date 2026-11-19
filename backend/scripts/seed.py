from __future__ import annotations

import argparse
import sys
from datetime import UTC, datetime, timedelta

from app.adapters.json_ticket_repository import JsonTicketRepository
from app.core.config import get_settings
from app.domain.enums import Categoria, Estado, Prioridad
from app.domain.models import Comentario, EventoHistorial, Ticket

MUESTRA = [
    (
        "Cambio de tóner en la sala de reuniones",
        "Las copias salen con franjas grises en el margen izquierdo.",
        Categoria.HARDWARE,
        Prioridad.BAJA,
        "u.multi",
        "u.admin",
        [Estado.EN_PROGRESO, Estado.RESUELTO, Estado.CERRADO],
        192,
    ),
    (
        "Instalar licencia de Office en notebook nueva",
        "La notebook entregada a Compras no tiene Office activado.",
        Categoria.SOFTWARE,
        Prioridad.BAJA,
        "u.usuario",
        "u.operador",
        [Estado.EN_PROGRESO, Estado.RESUELTO],
        98,
    ),
    (
        "La impresora del tercer piso no imprime",
        "Muestra 'error de bandeja 2' y deja la cola de impresión trabada.",
        Categoria.HARDWARE,
        Prioridad.ALTA,
        "u.usuario",
        "u.operador",
        [Estado.EN_PROGRESO],
        30,
    ),
    (
        "Alta de usuario en el sistema de legajos",
        "Ingresa una persona nueva a RR.HH. el lunes y necesita lectura de legajos.",
        Categoria.ACCESOS,
        Prioridad.MEDIA,
        "u.multi",
        None,
        [],
        20,
    ),
    (
        "La VPN se corta cada 10 minutos",
        "Desde el cambio de router la VPN se desconecta y pide el token otra vez.",
        Categoria.RED,
        Prioridad.CRITICA,
        "u.usuario",
        None,
        [],
        4,
    ),
]


def construir(numero: int, datos: tuple, ahora: datetime) -> Ticket:
    titulo, descripcion, categoria, prioridad, solicitante, responsable, recorrido, horas_atras = datos
    creado = ahora - timedelta(hours=horas_atras)
    historial = [EventoHistorial(campo="creacion", anterior=None, nuevo=Estado.ABIERTO, autor=solicitante, fecha=creado)]
    comentarios: list[Comentario] = []
    estado = Estado.ABIERTO
    momento = creado
    if responsable:
        momento += timedelta(minutes=15)
        historial.append(EventoHistorial(campo="responsable", anterior=None, nuevo=responsable, autor=responsable, fecha=momento))
    for siguiente in recorrido:
        momento += timedelta(hours=2)
        historial.append(
            EventoHistorial(campo="estado", anterior=estado, nuevo=siguiente, autor=responsable or "u.admin", fecha=momento)
        )
        estado = siguiente
        if siguiente is Estado.EN_PROGRESO and responsable:
            comentarios.append(Comentario(autor=responsable, texto="Tomado. Reviso y aviso por acá.", creado_en=momento))
    return Ticket(
        numero=numero,
        titulo=titulo,
        descripcion=descripcion,
        categoria=categoria,
        estado=estado,
        prioridad=prioridad,
        solicitante=solicitante,
        responsable=responsable,
        creado_en=creado,
        actualizado_en=momento,
        comentarios=comentarios,
        historial=historial,
    )


def main() -> int:
    parser = argparse.ArgumentParser(description="Crea el archivo de tickets con datos de ejemplo.")
    parser.add_argument("--force", action="store_true", help="Reemplaza el archivo existente")
    args = parser.parse_args()
    ruta = get_settings().ruta_tickets
    if ruta.exists() and not args.force:
        print(f"{ruta} ya existe. Usá --force para regenerarlo.")
        return 1
    if ruta.exists():
        ruta.unlink()
    repo = JsonTicketRepository(ruta)
    ahora = datetime.now(UTC)
    for datos in MUESTRA:
        repo.crear(lambda n, d=datos: construir(n, d, ahora))
    print(f"{len(MUESTRA)} tickets de ejemplo creados en {ruta}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
