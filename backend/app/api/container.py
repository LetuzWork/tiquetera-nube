from __future__ import annotations

from dataclasses import dataclass
from datetime import timedelta
from typing import Protocol
from zoneinfo import ZoneInfo

from app.adapters.csv_exporter import CsvExporter
from app.adapters.json_ticket_repository import JsonTicketRepository
from app.adapters.ldap_auth_provider import ConfigLdap, LdapAuthProvider
from app.adapters.mock_auth_provider import MockAuthProvider
from app.core.clock import Clock, OffsetClock, SystemClock
from app.core.config import Settings
from app.core.security import TokenService
from app.domain.enums import Rol
from app.ports.auth_provider import Autenticador, DirectorioGrupos
from app.ports.exporter import TabularExporter
from app.ports.ticket_repository import TicketReader, TicketWriter
from app.services.access_schedule import AccessSchedulePolicy
from app.services.auth_service import AuthService
from app.services.directory_service import DirectoryService
from app.services.login_throttle import LoginThrottle
from app.services.report_service import ReportService
from app.services.role_mapper import MapeadorRoles
from app.services.ticket_service import TicketService


@dataclass
class Container:
    settings: Settings
    clock: Clock
    horario: AccessSchedulePolicy
    tokens: TokenService
    auth: AuthService
    directorio: DirectoryService
    tickets: TicketService
    reportes: ReportService
    exportador: TabularExporter


class ProveedorDirectorio(Autenticador, DirectorioGrupos, Protocol):
    pass


def construir_container(
    settings: Settings,
    clock: Clock | None = None,
    proveedor: ProveedorDirectorio | None = None,
    repositorio: object | None = None,
) -> Container:
    clock = clock or _reloj(settings)
    zona = ZoneInfo(settings.access_timezone)
    mapeador = MapeadorRoles(
        {
            Rol.ADMIN: settings.ldap_group_admin,
            Rol.OPERADOR: settings.ldap_group_operador,
            Rol.USUARIO: settings.ldap_group_usuario,
            Rol.CONSULTA: settings.ldap_group_consulta,
        }
    )
    proveedor = proveedor or _proveedor(settings, mapeador)
    repo = repositorio or JsonTicketRepository(settings.ruta_tickets)
    lector: TicketReader = repo
    escritor: TicketWriter = repo
    horario = AccessSchedulePolicy(
        clock, zona, settings.access_window_start, settings.access_window_end, settings.dias_habilitados
    )
    throttle = LoginThrottle(clock, settings.login_max_attempts, timedelta(minutes=settings.login_lockout_minutes))
    directorio = DirectoryService(proveedor, mapeador)
    return Container(
        settings=settings,
        clock=clock,
        horario=horario,
        tokens=TokenService(settings.jwt_secret, settings.jwt_algorithm, timedelta(minutes=settings.jwt_ttl_minutes), clock),
        auth=AuthService(proveedor, horario, throttle, mapeador),
        directorio=directorio,
        tickets=TicketService(lector, escritor, directorio, clock),
        reportes=ReportService(lector, zona),
        exportador=CsvExporter(settings.csv_delimiter),
    )


def _reloj(settings: Settings) -> Clock:
    if settings.clock_override is None:
        return SystemClock()
    instante = settings.clock_override
    if instante.tzinfo is None:
        instante = instante.replace(tzinfo=ZoneInfo(settings.access_timezone))
    return OffsetClock(instante)


def _proveedor(settings: Settings, mapeador: MapeadorRoles) -> ProveedorDirectorio:
    if settings.auth_provider == "mock":
        if settings.app_env == "production":
            raise RuntimeError("El proveedor mock no puede usarse en producción")
        return MockAuthProvider(settings.mock_users_file)
    return LdapAuthProvider(
        ConfigLdap(
            uri=settings.ldap_uri,
            ca_cert=settings.ldap_ca_cert_path,
            timeout=settings.ldap_timeout_seconds,
            bind_dn=settings.ldap_bind_dn,
            bind_password=settings.ldap_bind_password,
            base_usuarios=settings.ldap_user_search_base or settings.ldap_base_dn,
            grupos=tuple(mapeador.grupos_de(list(Rol))),
            permitir_sin_tls=settings.app_env == "development",
        )
    )
