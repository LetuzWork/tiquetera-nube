from __future__ import annotations

from datetime import datetime, time
from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_env: Literal["development", "test", "production"] = "development"
    app_name: str = "Tiquetera Nube"
    api_prefix: str = "/api"
    cors_origins: str = "http://localhost:5173"

    auth_provider: Literal["mock", "ldap"] = "mock"
    mock_users_file: Path = Path("./mock_users.json")

    jwt_secret: str = Field(min_length=32)
    jwt_algorithm: Literal["HS256", "HS384", "HS512"] = "HS256"
    jwt_ttl_minutes: int = Field(default=60, ge=5, le=600)
    cookie_name: str = "tq_sesion"
    cookie_secure: bool = False

    ldap_uri: str = "ldaps://dc01.tiquetera.local:636"
    ldap_ca_cert_path: Path | None = None
    ldap_tls_nombre: str = ""
    ldap_timeout_seconds: int = Field(default=5, ge=1, le=60)
    ldap_base_dn: str = ""
    ldap_user_search_base: str = ""
    ldap_bind_dn: str = ""
    ldap_bind_password: str = ""
    ldap_group_admin: str = "GG-TQ-Admin"
    ldap_group_operador: str = "GG-TQ-Operador"
    ldap_group_usuario: str = "GG-TQ-Usuario"
    ldap_group_consulta: str = "GG-TQ-Consulta"

    access_timezone: str = "America/Argentina/Buenos_Aires"
    access_window_start: time = time(8, 0)
    access_window_end: time = time(18, 0)
    access_days: str = "1,2,3,4,5"
    clock_override: datetime | None = None

    login_max_attempts: int = Field(default=5, ge=1)
    login_lockout_minutes: int = Field(default=10, ge=1)

    data_dir: Path = Path("./data")
    tickets_file: str = "tickets.json"
    csv_delimiter: Literal[";", ","] = ";"

    @field_validator("clock_override", "ldap_ca_cert_path", mode="before")
    @classmethod
    def _vacio_es_none(cls, valor: object) -> object:
        return None if valor == "" else valor

    @field_validator("access_days")
    @classmethod
    def _dias_validos(cls, valor: str) -> str:
        dias = [d.strip() for d in valor.split(",") if d.strip()]
        if not dias or any(not d.isdigit() or not 1 <= int(d) <= 7 for d in dias):
            raise ValueError("ACCESS_DAYS debe ser una lista de días ISO entre 1 y 7")
        return ",".join(dias)

    @model_validator(mode="after")
    def _coherencia(self) -> Settings:
        if self.access_window_start >= self.access_window_end:
            raise ValueError("ACCESS_WINDOW_START debe ser anterior a ACCESS_WINDOW_END")
        if self.app_env == "production":
            if self.auth_provider == "mock":
                raise ValueError("AUTH_PROVIDER=mock no está permitido en producción")
            if self.clock_override is not None:
                raise ValueError("CLOCK_OVERRIDE no está permitido en producción")
            if not self.cookie_secure:
                raise ValueError("COOKIE_SECURE debe ser true en producción")
        return self

    @property
    def dias_habilitados(self) -> frozenset[int]:
        return frozenset(int(d) for d in self.access_days.split(","))

    @property
    def origenes_cors(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def ruta_tickets(self) -> Path:
        return self.data_dir / self.tickets_file


@lru_cache
def get_settings() -> Settings:
    return Settings()
