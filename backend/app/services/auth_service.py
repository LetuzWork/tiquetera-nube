from __future__ import annotations

import logging

from app.domain.errors import CredencialesInvalidas, FueraDeHorario, SinRol
from app.domain.models import Usuario
from app.ports.auth_provider import Autenticador
from app.services.access_schedule import AccessSchedulePolicy
from app.services.login_throttle import LoginThrottle, clave_intento
from app.services.role_mapper import MapeadorRoles

log = logging.getLogger(__name__)


class AuthService:
    def __init__(
        self,
        autenticador: Autenticador,
        horario: AccessSchedulePolicy,
        throttle: LoginThrottle,
        mapeador: MapeadorRoles,
    ) -> None:
        self._autenticador = autenticador
        self._horario = horario
        self._throttle = throttle
        self._mapeador = mapeador

    def iniciar_sesion(self, usuario: str, password: str, ip: str | None) -> Usuario:
        if not self._horario.permitido():
            log.info("Login rechazado fuera de horario: %s", usuario)
            raise FueraDeHorario(self._horario.proxima_apertura())
        clave = clave_intento(usuario, ip)
        self._throttle.verificar(clave)
        try:
            identidad = self._autenticador.autenticar(usuario, password)
        except CredencialesInvalidas:
            self._throttle.registrar_fallo(clave)
            log.info("Credenciales rechazadas: %s desde %s", usuario, ip)
            raise CredencialesInvalidas() from None
        rol = self._mapeador.resolver(identidad.grupos)
        if rol is None:
            log.info("Usuario sin rol mapeado: %s", identidad.usuario)
            raise SinRol()
        self._throttle.limpiar(clave)
        log.info("Login correcto: %s como %s", identidad.usuario, rol)
        return Usuario(usuario=identidad.usuario, nombre=identidad.nombre, mail=identidad.mail, rol=rol)
