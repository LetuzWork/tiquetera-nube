from __future__ import annotations

import pytest

from app.adapters.ldap_auth_provider import ConfigLdap, LdapAuthProvider


def _config(uri: str, nombre_tls: str = "", permitir_sin_tls: bool = False) -> ConfigLdap:
    return ConfigLdap(
        uri=uri,
        ca_cert=None,
        timeout=1,
        bind_dn="CN=svc,DC=tpsnube,DC=local",
        bind_password="x",
        base_usuarios="DC=tpsnube,DC=local",
        grupos=(),
        permitir_sin_tls=permitir_sin_tls,
        nombre_tls=nombre_tls,
    )


def test_ldaps_por_ip_valida_contra_el_nombre_del_dc() -> None:
    servidor = LdapAuthProvider(_config("ldaps://20.226.44.141:636", "srv-ad.tpsnube.local"))._server
    assert servidor.host == "20.226.44.141"
    assert servidor.port == 636
    assert servidor.ssl is True
    assert servidor.tls.valid_names == ["srv-ad.tpsnube.local"]


def test_ldaps_sin_nombre_extra_usa_solo_el_host() -> None:
    servidor = LdapAuthProvider(_config("ldaps://srv-ad.tpsnube.local"))._server
    assert servidor.port == 636
    assert servidor.tls.valid_names is None


def test_ldap_sin_tls_se_rechaza_fuera_de_development() -> None:
    with pytest.raises(ValueError):
        LdapAuthProvider(_config("ldap://20.226.44.141"))