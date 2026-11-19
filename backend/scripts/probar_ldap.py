from __future__ import annotations

import getpass
import sys

from app.adapters.ldap_auth_provider import ConfigLdap, LdapAuthProvider
from app.core.config import get_settings
from app.domain.enums import Rol
from app.domain.errors import ErrorDominio
from app.services.role_mapper import MapeadorRoles


def main() -> int:
    s = get_settings()
    grupos = {
        Rol.ADMIN: s.ldap_group_admin,
        Rol.OPERADOR: s.ldap_group_operador,
        Rol.USUARIO: s.ldap_group_usuario,
        Rol.CONSULTA: s.ldap_group_consulta,
    }
    mapeador = MapeadorRoles(grupos)
    proveedor = LdapAuthProvider(
        ConfigLdap(
            uri=s.ldap_uri,
            ca_cert=s.ldap_ca_cert_path,
            timeout=s.ldap_timeout_seconds,
            bind_dn=s.ldap_bind_dn,
            bind_password=s.ldap_bind_password,
            base_usuarios=s.ldap_user_search_base or s.ldap_base_dn,
            grupos=tuple(grupos.values()),
            permitir_sin_tls=s.app_env == "development",
            nombre_tls=s.ldap_tls_nombre,
        )
    )
    print(f"Conectando a {s.ldap_uri} validando el certificado de {s.ldap_tls_nombre or 'ese mismo host'}")
    try:
        for rol, grupo in grupos.items():
            personas = proveedor.miembros_de([grupo])
            print(f"{rol.value:<10} {', '.join(p.usuario for p in personas) or '(nadie)'}")
        if len(sys.argv) > 1:
            usuario = sys.argv[1]
            identidad = proveedor.autenticar(usuario, getpass.getpass(f"Clave de {usuario}: "))
            rol = mapeador.resolver(identidad.grupos)
            print(f"Login OK: {identidad.nombre}, rol {rol.value if rol else 'sin rol'}")
    except ErrorDominio as e:
        print(f"Error: {type(e).__name__}")
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
