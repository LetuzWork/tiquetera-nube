from __future__ import annotations

import logging
import re
import ssl
from collections.abc import Iterable
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import urlparse

from ldap3 import BASE, NONE, SUBTREE, Connection, Server, Tls
from ldap3.core.exceptions import LDAPBindError, LDAPException
from ldap3.utils.conv import escape_filter_chars

from app.domain.errors import CredencialesInvalidas, CuentaDeshabilitada, DirectorioNoDisponible
from app.domain.models import IdentidadDirectorio, Persona

PATRON_USUARIO = re.compile(r"[A-Za-z0-9._-]{1,64}")
REGLA_EN_CADENA = "1.2.840.113556.1.4.1941"
UAC_DESHABILITADA = 0x2

log = logging.getLogger(__name__)


@dataclass(frozen=True)
class ConfigLdap:
    uri: str
    ca_cert: Path | None
    timeout: int
    bind_dn: str
    bind_password: str
    base_usuarios: str
    grupos: tuple[str, ...]
    permitir_sin_tls: bool = False


class LdapAuthProvider:
    def __init__(self, config: ConfigLdap) -> None:
        self._cfg = config
        self._server = self._crear_servidor()

    def autenticar(self, usuario: str, password: str) -> IdentidadDirectorio:
        if not PATRON_USUARIO.fullmatch(usuario) or not password:
            raise CredencialesInvalidas()
        try:
            with self._conexion_servicio() as c:
                filtro = f"(&(objectCategory=person)(objectClass=user)(sAMAccountName={escape_filter_chars(usuario)}))"
                c.search(
                    self._cfg.base_usuarios,
                    filtro,
                    SUBTREE,
                    attributes=["sAMAccountName", "displayName", "mail", "userAccountControl"],
                    size_limit=2,
                )
                if len(c.entries) != 1:
                    raise CredencialesInvalidas()
                entrada = c.entries[0]
                dn = entrada.entry_dn
                if int(entrada.userAccountControl.value or 0) & UAC_DESHABILITADA:
                    raise CuentaDeshabilitada()
                grupos = frozenset(g for g in self._cfg.grupos if self._es_miembro(c, dn, g))
            self._verificar_password(dn, password)
        except (CredencialesInvalidas, DirectorioNoDisponible):
            raise
        except LDAPException as e:
            log.warning("Fallo de directorio autenticando %s: %s", usuario, type(e).__name__)
            raise DirectorioNoDisponible() from e
        return IdentidadDirectorio(
            usuario=str(entrada.sAMAccountName.value),
            nombre=str(entrada.displayName.value or entrada.sAMAccountName.value),
            mail=str(entrada.mail.value) if entrada.mail.value else None,
            grupos=grupos,
        )

    def miembros_de(self, grupos: Iterable[str]) -> list[Persona]:
        personas: dict[str, Persona] = {}
        try:
            with self._conexion_servicio() as c:
                for grupo in grupos:
                    filtro = (
                        "(&(objectCategory=person)(objectClass=user)"
                        f"(memberOf:{REGLA_EN_CADENA}:={escape_filter_chars(grupo)})"
                        "(!(userAccountControl:1.2.840.113556.1.4.803:=2)))"
                    )
                    c.search(self._cfg.base_usuarios, filtro, SUBTREE, attributes=["sAMAccountName", "displayName", "mail"])
                    for e in c.entries:
                        sam = str(e.sAMAccountName.value)
                        personas[sam] = Persona(
                            usuario=sam,
                            nombre=str(e.displayName.value or sam),
                            mail=str(e.mail.value) if e.mail.value else None,
                        )
        except LDAPException as e:
            raise DirectorioNoDisponible() from e
        return sorted(personas.values(), key=lambda p: p.usuario)

    def _es_miembro(self, c: Connection, dn: str, grupo: str) -> bool:
        c.search(dn, f"(memberOf:{REGLA_EN_CADENA}:={escape_filter_chars(grupo)})", BASE, attributes=[])
        return bool(c.entries)

    def _verificar_password(self, dn: str, password: str) -> None:
        conexion = Connection(self._server, user=dn, password=password, receive_timeout=self._cfg.timeout)
        try:
            if not conexion.bind():
                raise CredencialesInvalidas()
        except LDAPBindError as e:
            raise CredencialesInvalidas() from e
        finally:
            conexion.unbind()

    def _conexion_servicio(self) -> Connection:
        try:
            return Connection(
                self._server,
                user=self._cfg.bind_dn,
                password=self._cfg.bind_password,
                auto_bind=True,
                receive_timeout=self._cfg.timeout,
                read_only=True,
            )
        except LDAPException as e:
            log.error("No se pudo hacer bind con la cuenta de servicio: %s", type(e).__name__)
            raise DirectorioNoDisponible() from e

    def _crear_servidor(self) -> Server:
        url = urlparse(self._cfg.uri)
        seguro = url.scheme == "ldaps"
        if url.scheme not in {"ldap", "ldaps"} or not url.hostname:
            raise ValueError(f"LDAP_URI inválida: {self._cfg.uri}")
        if not seguro and not self._cfg.permitir_sin_tls:
            raise ValueError("LDAP sin TLS solo se permite en development; usá ldaps://")
        tls = None
        if seguro:
            ca = str(self._cfg.ca_cert) if self._cfg.ca_cert else None
            tls = Tls(validate=ssl.CERT_REQUIRED, version=ssl.PROTOCOL_TLS_CLIENT, ca_certs_file=ca)
        return Server(
            url.hostname,
            port=url.port or (636 if seguro else 389),
            use_ssl=seguro,
            tls=tls,
            get_info=NONE,
            connect_timeout=self._cfg.timeout,
        )
