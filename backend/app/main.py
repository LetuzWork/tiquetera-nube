from __future__ import annotations

import logging
from urllib.parse import urlparse

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.container import Container, construir_container
from app.api.routers import auth, reportes, tickets, usuarios
from app.core.config import Settings, get_settings
from app.domain.errors import ErrorDominio

METODOS_MUTANTES = {"POST", "PUT", "PATCH", "DELETE"}
RUTAS_DOCS = ("/docs", "/redoc", "/openapi.json")


def create_app(settings: Settings | None = None, container: Container | None = None) -> FastAPI:
    settings = settings or get_settings()
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    app = FastAPI(title=settings.app_name, version="0.1.0", docs_url=None if settings.app_env == "production" else "/docs")
    app.state.container = container or construir_container(settings)
    origenes = settings.origenes_cors

    app.add_middleware(
        CORSMiddleware,
        allow_origins=origenes,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PATCH"],
        allow_headers=["Content-Type"],
    )

    @app.middleware("http")
    async def proteger(request: Request, call_next):
        if request.method in METODOS_MUTANTES:
            origen = request.headers.get("origin")
            if origen and _origen(origen) not in {_origen(o) for o in origenes} | {_origen(str(request.base_url))}:
                return _error(403, "ORIGEN_NO_PERMITIDO", "Origen no permitido.")
            tipo = request.headers.get("content-type", "")
            if not tipo.startswith("application/json"):
                return _error(415, "TIPO_NO_SOPORTADO", "Las operaciones deben enviarse como application/json.")
        respuesta = await call_next(request)
        respuesta.headers["X-Content-Type-Options"] = "nosniff"
        respuesta.headers["X-Frame-Options"] = "DENY"
        respuesta.headers["Referrer-Policy"] = "no-referrer"
        respuesta.headers["Cache-Control"] = "no-store"
        if not request.url.path.startswith(RUTAS_DOCS):
            respuesta.headers["Content-Security-Policy"] = "default-src 'none'; frame-ancestors 'none'"
        return respuesta

    @app.exception_handler(ErrorDominio)
    async def error_dominio(_: Request, e: ErrorDominio) -> JSONResponse:
        return _error(e.estado_http, e.codigo, e.detalle, **e.extra)

    @app.exception_handler(RequestValidationError)
    async def error_validacion(_: Request, e: RequestValidationError) -> JSONResponse:
        errores = [
            {"campo": ".".join(str(p) for p in err["loc"] if p not in ("body", "query", "path")), "mensaje": err["msg"]}
            for err in e.errors()
        ]
        return _error(422, "ENTRADA_INVALIDA", "Revisá los datos enviados.", errores=errores)

    for r in (auth.router, tickets.router, reportes.router, usuarios.router):
        app.include_router(r, prefix=settings.api_prefix)

    @app.get(f"{settings.api_prefix}/health", tags=["health"])
    def health() -> dict[str, str]:
        return {"estado": "ok", "proveedor": settings.auth_provider}

    return app


def _origen(url: str) -> str:
    p = urlparse(url)
    return f"{p.scheme}://{p.netloc}".lower()


def _error(estado: int, codigo: str, detalle: str, **extra: object) -> JSONResponse:
    return JSONResponse(status_code=estado, content={"codigo": codigo, "detalle": detalle, **extra})
