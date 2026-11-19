from __future__ import annotations

from app.domain.enums import Permiso, Rol

_TODOS = frozenset(Permiso)

MATRIZ: dict[Rol, frozenset[Permiso]] = {
    Rol.ADMIN: _TODOS,
    Rol.OPERADOR: _TODOS - {Permiso.TICKET_REABRIR_CERRADO},
    Rol.USUARIO: frozenset({Permiso.TICKET_CREAR, Permiso.TICKET_VER_PROPIOS, Permiso.TICKET_COMENTAR}),
    Rol.CONSULTA: frozenset(
        {Permiso.TICKET_VER_PROPIOS, Permiso.TICKET_VER_TODOS, Permiso.REPORTE_VER, Permiso.REPORTE_EXPORTAR}
    ),
}

PRECEDENCIA: tuple[Rol, ...] = (Rol.ADMIN, Rol.OPERADOR, Rol.USUARIO, Rol.CONSULTA)

ROLES_RESPONSABLES: frozenset[Rol] = frozenset({Rol.ADMIN, Rol.OPERADOR})


def permisos_de(rol: Rol) -> frozenset[Permiso]:
    return MATRIZ[rol]
