# Tiquetera Nube — Plan de proyecto

## 1. Objetivo

Ticketera web de soporte con autenticación contra Active Directory (LDAP/LDAPS), roles derivados de grupos de AD, restricción horaria de inicio de sesión, persistencia en archivo local JSON y exportación CSV.

## 2. Stack

| Capa | Tecnología | Motivo |
|---|---|---|
| Frontend | React 18 + TypeScript + Vite + React Router | SPA liviana, tipado estricto |
| Estilos | CSS custom properties + CSS Modules | Identidad propia, sin kits genéricos (ver `DISENO.md`) |
| Backend | FastAPI + Pydantic v2 + Uvicorn | Validación declarativa de entradas, OpenAPI automático |
| Entorno Python | pipenv (`backend/Pipfile`) | Requisito del TP |
| Directorio | `ldap3` contra Windows Server AD en VirtualBox | LDAPS 636, bind de servicio + bind del usuario |
| Sesión | JWT firmado (PyJWT) en cookie `HttpOnly` + `SameSite=Strict` | No expone el token a JS |
| Persistencia | `data/tickets.json` con escritura atómica + `filelock` | Requisito: archivo local |
| Tests | pytest + httpx | Servicios testeables gracias a inversión de dependencias |

## 3. Estructura de carpetas

```
Tiquetera Nube/
├─ backend/
│  ├─ Pipfile
│  ├─ .env.example
│  ├─ mock_users.example.json
│  ├─ certs/                    CA del AD en PEM (no se versiona)
│  ├─ data/                     tickets.json (no se versiona)
│  ├─ scripts/seed.py           "script de base de datos": crea/puebla el JSON
│  ├─ app/
│  │  ├─ main.py                app factory, CORS, routers, handlers
│  │  ├─ core/
│  │  │  ├─ config.py           Settings (pydantic-settings)
│  │  │  ├─ security.py         emisión/validación JWT, cookie
│  │  │  └─ clock.py            Clock (puerto) + SystemClock / FixedClock
│  │  ├─ domain/
│  │  │  ├─ enums.py            Estado, Prioridad, Rol, Permiso
│  │  │  ├─ models.py           Ticket, Comentario, EventoHistorial, Usuario
│  │  │  ├─ permissions.py      matriz Rol → Permisos
│  │  │  ├─ transitions.py      máquina de estados de tickets
│  │  │  └─ errors.py           excepciones de dominio
│  │  ├─ ports/
│  │  │  ├─ ticket_repository.py   TicketReader / TicketWriter (Protocol)
│  │  │  ├─ auth_provider.py       AuthProvider (Protocol)
│  │  │  └─ exporter.py            TabularExporter (Protocol)
│  │  ├─ adapters/
│  │  │  ├─ json_ticket_repository.py
│  │  │  ├─ memory_ticket_repository.py   (tests)
│  │  │  ├─ ldap_auth_provider.py
│  │  │  ├─ mock_auth_provider.py         (solo APP_ENV=development)
│  │  │  └─ csv_exporter.py
│  │  ├─ services/
│  │  │  ├─ access_schedule.py  AccessSchedulePolicy
│  │  │  ├─ auth_service.py     orquesta horario + proveedor + mapeo de rol
│  │  │  ├─ login_throttle.py   bloqueo por intentos fallidos
│  │  │  ├─ ticket_service.py   casos de uso de tickets
│  │  │  └─ report_service.py   métricas y datasets de reporte
│  │  └─ api/
│  │     ├─ container.py        composición (único lugar que conoce implementaciones)
│  │     ├─ deps.py             get_current_user, require(Permiso)
│  │     ├─ schemas.py          DTOs de entrada/salida
│  │     └─ routers/ auth.py, tickets.py, reportes.py, usuarios.py
│  └─ tests/
├─ frontend/
│  ├─ .env.example
│  └─ src/
│     ├─ theme/                 tokens.css, theme.ts, ThemeContext.tsx
│     ├─ api/                   cliente fetch tipado (credentials: "include")
│     ├─ auth/                  AuthContext, ProtectedRoute, <Can permiso=…>
│     ├─ components/            Talon, Sello, Perforado, Ponchado, Libreta…
│     └─ pages/                 Login, Bandeja, NuevoTicket, DetalleTicket, Reportes
├─ scripts/ad/                  PowerShell para montar el DC del laboratorio
└─ docs/
   ├─ PLAN.md
   ├─ DISENO.md
   └─ AD_SETUP.md
```

## 4. SOLID aplicado

| Principio | Dónde se aplica |
|---|---|
| **S** — Responsabilidad única | `AccessSchedulePolicy` solo decide si la hora es válida; `AuthService` solo orquesta el login; `TicketService` solo casos de uso; `CsvExporter` solo serializa; los routers solo traducen HTTP ↔ servicio. |
| **O** — Abierto/cerrado | Nueva persistencia (SQLite, otro JSON) = nuevo adapter que implementa `TicketReader/TicketWriter`, sin tocar servicios. Nuevo formato de exportación = nuevo `TabularExporter`. Nuevos roles = una fila en la matriz de permisos. |
| **L** — Sustitución de Liskov | `LdapAuthProvider` y `MockAuthProvider` devuelven el mismo `IdentidadDirectorio` y lanzan las mismas excepciones de dominio; `JsonTicketRepository` y `MemoryTicketRepository` son intercambiables en tests. |
| **I** — Segregación de interfaces | `TicketReader` (listar, obtener) separado de `TicketWriter` (guardar). `ReportService` depende solo de `TicketReader`. |
| **D** — Inversión de dependencias | Servicios reciben puertos (`Protocol`) por constructor; `api/container.py` es el único que instancia implementaciones concretas según `Settings`. `Clock` inyectado permite testear y simular la restricción horaria. |

## 5. Modelo de dominio

**Ticket**
| Campo | Tipo | Notas |
|---|---|---|
| `id` | `str` | `TQ-000001`, secuencial |
| `titulo` | `str` | 5–120 caracteres |
| `descripcion` | `str` | 10–5000 caracteres |
| `categoria` | `Literal` | Hardware, Software, Red, Accesos, Otro |
| `estado` | `Estado` | ABIERTO, EN_PROGRESO, RESUELTO, CERRADO |
| `prioridad` | `Prioridad` | BAJA, MEDIA, ALTA, CRITICA |
| `solicitante` | `str` | `sAMAccountName` del creador |
| `responsable` | `str \| None` | `sAMAccountName` de un Operador/Admin |
| `creado_en` / `actualizado_en` | `datetime` | UTC, ISO 8601 |
| `comentarios` | `list[Comentario]` | autor, texto, fecha |
| `historial` | `list[EventoHistorial]` | campo, valor_anterior, valor_nuevo, autor, fecha |

**Máquina de estados**

```
ABIERTO ──► EN_PROGRESO ──► RESUELTO ──► CERRADO
   │             ▲              │
   │             └──────────────┘  (reapertura)
   └──────────────────────────────► CERRADO  (descartado)
CERRADO ──► EN_PROGRESO  solo Admin
```

Cada cambio de estado, prioridad o responsable genera un `EventoHistorial` automáticamente en `TicketService`; el historial nunca se edita.

## 6. Roles y permisos

Grupos de AD (configurables por env) → rol de la app. Si el usuario pertenece a varios, gana el de mayor privilegio. Sin grupo mapeado → 403.

| Grupo AD | Rol |
|---|---|
| `GG-TQ-Admin` | Admin |
| `GG-TQ-Operador` | Operador |
| `GG-TQ-Usuario` | Usuario |
| `GG-TQ-Consulta` | Consulta |

| Permiso | Admin | Operador | Usuario | Consulta |
|---|:-:|:-:|:-:|:-:|
| `ticket:crear` | ✔ | ✔ | ✔ | |
| `ticket:ver_propios` | ✔ | ✔ | ✔ | ✔ |
| `ticket:ver_todos` | ✔ | ✔ | | ✔ |
| `ticket:editar` | ✔ | ✔ | | |
| `ticket:cambiar_estado` | ✔ | ✔ | | |
| `ticket:asignar` | ✔ | ✔ | | |
| `ticket:comentar` | ✔ | ✔ | ✔ (propios) | |
| `ticket:reabrir_cerrado` | ✔ | | | |
| `reporte:ver` | ✔ | ✔ | | ✔ |
| `reporte:exportar` | ✔ | ✔ | | ✔ |

La autorización se valida **siempre en el backend** (`require(Permiso)` + chequeo de propiedad en `TicketService`). El frontend solo oculta controles con `<Can>`.

## 7. Restricción horaria

- `AccessSchedulePolicy(clock, zona, inicio, fin, dias)` → `permitido(): bool` y `proxima_apertura(): datetime`.
- Se evalúa en `POST /auth/login` **antes** de tocar el AD (no se filtran credenciales fuera de horario).
- El JWT expira como máximo al cierre de la franja (`exp = min(ahora + TTL, fin_franja)`), y `get_current_user` re-valida la franja en cada request → al pasar las 18:00 la sesión muere.
- Respuesta fuera de horario: `403` con `{codigo: "FUERA_DE_HORARIO", apertura: "..."}` para que el front muestre la pantalla de "ventanilla cerrada".
- `CLOCK_OVERRIDE` (solo `APP_ENV=development`) inyecta un `FixedClock` para capturar la evidencia sin esperar a las 18:01.

## 8. Autenticación LDAP

1. Validar `usuario` con regex `^[A-Za-z0-9._-]{1,64}$` y `password` no vacía (evita *unauthenticated bind* que AD acepta como éxito).
2. Bind con cuenta de servicio de solo lectura (`svc-tiquetera`).
3. Buscar `(&(objectCategory=person)(objectClass=user)(sAMAccountName={escape_filter_chars(usuario)}))` en `LDAP_USER_SEARCH_BASE`; traer `distinguishedName`, `displayName`, `mail`, `userAccountControl`.
4. Rechazar cuentas deshabilitadas (`userAccountControl & 2`).
5. Bind como el DN encontrado con la contraseña del usuario → valida credenciales.
6. Grupos: búsqueda con `memberOf:1.2.840.113556.1.4.1941:=` (incluye grupos anidados) contra los DNs configurados.
7. Conexión por LDAPS (636) validando la CA exportada del DC (`LDAP_CA_CERT_PATH`), `ssl.CERT_REQUIRED`.
8. Mensaje de error genérico al cliente ("Credenciales inválidas"); detalle solo en log.

`MockAuthProvider` lee `mock_users.json` con el mismo contrato y solo se habilita con `APP_ENV=development` y `AUTH_PROVIDER=mock`; al arrancar en otro entorno con mock, la app aborta.

## 9. API

| Método | Ruta | Permiso |
|---|---|---|
| POST | `/api/auth/login` | público (con horario) |
| POST | `/api/auth/logout` | autenticado |
| GET | `/api/auth/me` | autenticado → usuario, rol, permisos, cierre de franja |
| GET | `/api/tickets?estado=&prioridad=&responsable=&q=&desde=&hasta=&page=` | ver_propios / ver_todos |
| POST | `/api/tickets` | ticket:crear |
| GET | `/api/tickets/{id}` | ver_propios (si es suyo) / ver_todos |
| PATCH | `/api/tickets/{id}` | ticket:editar (título, descripción, categoría, prioridad) |
| POST | `/api/tickets/{id}/estado` | ticket:cambiar_estado |
| POST | `/api/tickets/{id}/asignacion` | ticket:asignar |
| POST | `/api/tickets/{id}/comentarios` | ticket:comentar |
| GET | `/api/usuarios/responsables` | ticket:asignar |
| GET | `/api/reportes/resumen?desde=&hasta=` | reporte:ver |
| GET | `/api/reportes/export/tickets.csv` (mismos filtros) | reporte:exportar |
| GET | `/api/reportes/export/historial.csv` | reporte:exportar |
| GET | `/api/health` | público |

Reportes del resumen: tickets por estado, por prioridad, por responsable, abiertos vs. cerrados por día, tiempo medio de resolución.

## 10. Seguridad

| Riesgo | Mitigación |
|---|---|
| Inyección LDAP | `escape_filter_chars` en todo valor que entra a un filtro + whitelist regex del usuario |
| Inyección SQL | No hay motor SQL; persistencia JSON serializada por Pydantic, nunca se concatena texto en consultas. Si se migra a SQLite, adapter con parámetros enlazados (`?`) |
| Inyección de fórmulas CSV | Celdas que empiezan con `= + - @ \t \r` se prefijan con `'` en `CsvExporter` |
| Validación de entradas | Esquemas Pydantic con `max_length`, `Literal`/`Enum`, `extra="forbid"` |
| XSS | React escapa por defecto; prohibido `dangerouslySetInnerHTML`; headers `X-Content-Type-Options`, `Content-Security-Policy` |
| Robo de sesión | JWT en cookie `HttpOnly`, `SameSite=Strict`, `Secure` en producción, TTL corto |
| CSRF | `SameSite=Strict` + exigir `Content-Type: application/json` en mutaciones |
| Fuerza bruta | `LoginThrottle`: N intentos por usuario+IP en ventana → bloqueo temporal |
| Escalada de privilegios | Permisos resueltos en backend desde grupos AD en cada login; chequeo de propiedad por ticket |
| Credenciales en repo | `.env` y `certs/` en `.gitignore`; solo se versionan `.env.example` |
| Integridad del archivo | Escritura a `.tmp` + `os.replace` (atómico) bajo `FileLock`; backup rotativo `tickets.json.bak` |
| Transporte LDAP | LDAPS con validación de CA; nunca bind simple en 389 sin TLS |

## 11. Fases

| Fase | Entregable | Criterio de hecho |
|---|---|---|
| F0 | Entorno: `pipenv install --dev`, `npm create vite`, envs, `.gitignore` | `uvicorn app.main:app` y `npm run dev` levantan |
| F1 | Dominio + puertos + repo JSON + seed | tests de transiciones y repositorio en verde |
| F2 | Auth: Mock + LDAP + horario + throttle + JWT | tests de `AuthService` con `FixedClock` |
| F3 | API de tickets con permisos y historial | tests por rol (matriz de §6) |
| F4 | Reportes + exportación CSV | CSV abre en Excel con UTF-8 BOM y `;` configurable |
| F5 | Frontend: theme, login, bandeja, alta, detalle, reportes | navegación por rol coherente con la matriz |
| F6 | Laboratorio AD en VirtualBox (`AD_SETUP.md`) | login real con los 4 usuarios de prueba |
| F7 | Documento de evidencias + documentación técnica | todas las capturas de §12 |

## 12. Evidencias a capturar

| Captura | Cómo producirla |
|---|---|
| Inicio de sesión | `/login` con `AUTH_PROVIDER=ldap` |
| Fuera de horario | `CLOCK_OVERRIDE=2026-11-05T19:30:00` o ajustar `ACCESS_WINDOW_*` |
| Creación de tickets | `/tickets/nuevo` con `u.usuario` |
| Gestión/actualización | `/tickets/TQ-…` con `u.operador`: estado, asignación, comentario, historial |
| Permisos por rol | Misma bandeja con los 4 usuarios + intento de acción prohibida (403) |
| Consultas y reportes | `/reportes` con `u.consulta` |
| Exportación CSV | Descarga + archivo abierto en Excel |

## 13. Convenciones

- Sin comentarios multilínea ni banners; a lo sumo una línea en funciones genuinamente complejas.
- Python: `ruff` (lint + format), type hints en todo, `from __future__ import annotations`.
- TS: `strict: true`, sin `any`.
- Nombres de dominio en español (Ticket, Estado, Prioridad); infraestructura en inglés (repository, provider).
