# Entrega

TP de Martin Laguna y Jeampierre Peralta.

Acá está todo lo que pide la consigna para entregar:

- **[codigo-fuente.zip](codigo-fuente.zip)**: el código completo.
- **[Evidencias.pdf](Evidencias.pdf)**: las capturas mostrando que anda.
- **[DOCUMENTACION-TECNICA.md](DOCUMENTACION-TECNICA.md)**: qué tecnologías usamos y cómo está armado.

## El código

El zip es el repo entero, sin `node_modules` ni archivos con claves. Para encontrar lo que pide la consigna:

- La app: `backend/app` (FastAPI) y `frontend/src` (React).
- La configuración: los `.env.example` del backend y del frontend, `backend/mock_users.example.json`, `backend/Pipfile` y `package.json`.
- Los scripts de base de datos: `backend/scripts/seed.py`, que crea `data/tickets.json` con tickets de ejemplo. Y en `scripts/ad/` están los que arman el AD (usuarios, grupos y LDAPS).
- Cómo correrlo: `README.md`, `COMANDOS.md`, `AD.md` y la carpeta `docs/`.

## Las evidencias

Cada cosa que pide la consigna tiene su sección en el PDF:

| La consigna pide | Sección | Capturas |
|---|---|---|
| Pantalla de inicio de sesión | 2 | 01 |
| No dejar entrar fuera de horario | 3 | 02 y 03 |
| Crear tickets | 4 | 05 y 06 |
| Gestionar y actualizar tickets | 5 | 07, 08 y 09 |
| Permisos de cada rol | 6 | 04, 10, 11, 12 y 13 |
| Consultas y reportes | 7 | 14 y 15 |
| Exportar a CSV | 8 | 16, más los CSV |

Las capturas sueltas están en [evidencias/capturas](evidencias/capturas) y los CSV que exportamos en [evidencias](evidencias). Todas se sacaron logueando contra el AD de verdad que tenemos en Azure (`tpsnube.local`), no con los usuarios mock.
