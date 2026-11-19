# Tiquetera Nube

Ticketera de soporte con autenticación contra Active Directory, roles por grupos de AD, restricción horaria de acceso, persistencia en JSON y exportación CSV.

| Documento | Contenido |
|---|---|
| [CONSIGNA.md](CONSIGNA.md) | enunciado del TP y requisitos agregados |
| [docs/PLAN.md](docs/PLAN.md) | arquitectura SOLID, dominio, permisos, API, seguridad, fases |
| [docs/DISENO.md](docs/DISENO.md) | identidad visual "Cielo": la jornada como luz, tokens, tipografía, componentes |
| [docs/AD_SETUP.md](docs/AD_SETUP.md) | laboratorio de AD en Azure (y alternativa en VirtualBox) |
| [COMANDOS.md](COMANDOS.md) | todos los comandos para instalar, levantar, probar, usar la API y administrar el AD |

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
CLOCK_OVERRIDE=2026-11-05T19:30:00   fuera del horario
```

La hora simulada avanza normalmente desde ese punto. Dejar vacío para usar el reloj real.

## Modo demostración para la presentación

Para mostrar la app a la noche sin tocar `.env` en cada cambio, hay un reloj de demostración que se maneja desde la interfaz:

1. En `backend/.env`, con `APP_ENV=development`, poner `DEMO_RELOJ=true` y reiniciar el backend. Con `APP_ENV=production` la configuración no arranca.
2. Abajo a la izquierda, en el inicio de sesión y dentro de la app, aparece el botón **Demo · HH:MM** con la hora del servidor. Al abrirlo trae 08:00, 12:00, 17:55 y 19:30, el campo **Otra hora** con **Aplicar**, y **Hora real**.
3. La hora elegida es la de hoy y rige en todo el backend: franja, ingreso, sesiones, bloqueo de intentos y fechas de los tickets. Desde ahí avanza sola.

Por ejemplo, 17:55 muestra "Cierra en 5 min", y pasar de 12:00 a 19:30 con la sesión abierta muestra "La jornada terminó". **Hora real** vuelve a la hora del sistema, aunque haya `CLOCK_OVERRIDE`. Al reiniciar el backend se vuelve a `CLOCK_OVERRIDE` o a la hora real.

Cambia solo la hora, no el día: si la presentación cae en fin de semana, sumar `CLOCK_OVERRIDE` con un día hábil y el reloj arranca ahí. Los endpoints (`/api/demo/reloj`) no piden sesión, porque hacen falta antes de ingresar; fuera de la presentación, dejar `DEMO_RELOJ=false`: así no existen y el botón no aparece.

## Tests

```powershell
cd backend
pipenv run test
pipenv run lint
cd ..\frontend
npm run typecheck
npm run test
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

Para autenticar contra el AD real cambiar `AUTH_PROVIDER=ldap` y completar las variables `LDAP_*` según `COMANDOS.md` (sección 8).
