# Tiquetera Nube

Ticketera de soporte con autenticación contra Active Directory, roles por grupos de AD, restricción horaria de acceso, persistencia en JSON y exportación CSV.

| Documento | Contenido |
|---|---|
| [CONSIGNA.md](CONSIGNA.md) | enunciado del TP y requisitos agregados |
| [docs/PLAN.md](docs/PLAN.md) | arquitectura SOLID, dominio, permisos, API, seguridad, fases |
| [docs/DISENO.md](docs/DISENO.md) | identidad visual "Talonario": paleta, tipografía, componentes |
| [docs/AD_SETUP.md](docs/AD_SETUP.md) | laboratorio de AD en VirtualBox |

## Puesta en marcha

Todo junto, desde la raíz:

```powershell
copy backend\.env.example backend\.env
copy backend\mock_users.example.json backend\mock_users.json
copy frontend\.env.example frontend\.env
npm run setup
cd backend; pipenv run seed; cd ..
npm run dev
```

`npm run dev` levanta backend (prefijo `BE`) y frontend (prefijo `FE`) en la misma terminal; si uno cae, se detienen ambos. Cortar con `Ctrl+C`.

En `backend/.env` completar `JWT_SECRET` con un valor aleatorio largo:

```powershell
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

`pipenv` carga `backend/.env` al arrancar, así que **cualquier cambio en `.env` requiere reiniciar `npm run dev`**.

## Usuarios de prueba (modo mock)

Con `AUTH_PROVIDER=mock` se usan los usuarios de `backend/mock_users.json` (`u.admin`, `u.operador`, `u.usuario`, `u.consulta`); las contraseñas están en ese archivo.

## Simular la hora

Para probar o capturar evidencias a cualquier hora, en `backend/.env` (solo `APP_ENV=development`):

```
CLOCK_OVERRIDE=2026-11-05T15:30:00   dentro de la franja
CLOCK_OVERRIDE=2026-11-05T19:30:00   ventanilla cerrada
```

La hora simulada avanza normalmente desde ese punto. Dejar vacío para usar el reloj real.

## Tests

```powershell
cd backend
pipenv run test
pipenv run lint
cd ..\frontend
npm run typecheck
```

Por separado, backend:

```powershell
cd backend
copy .env.example .env
copy mock_users.example.json mock_users.json
pipenv install --dev
pipenv run seed
pipenv run dev
```

Frontend:

```powershell
cd frontend
copy .env.example .env
npm install
npm run dev
```

App en `http://localhost:5173`, API en `http://localhost:8000/api`, OpenAPI en `http://localhost:8000/docs`.

Para autenticar contra el AD real cambiar `AUTH_PROVIDER=ldap` y completar las variables `LDAP_*` según `docs/AD_SETUP.md`.
