# Tiquetera Nube

TP de Martin Laguna y Jeampierre Peralta.

Es una ticketera de soporte: entrás con tu usuario del Active Directory, según en qué grupo del AD estés te toca un rol, y solo te deja entrar de lunes a viernes de 8 a 18. Los tickets se guardan en un JSON y se pueden bajar en CSV.

## Qué hay en el repo

- [CONSIGNA.md](CONSIGNA.md): el enunciado del TP y lo que le sumamos nosotros.
- [entregables/](entregables/README.md): lo que se entrega (código en zip, evidencias con capturas y la doc técnica).
- [COMANDOS.md](COMANDOS.md): todos los comandos para instalar, levantar, probar y pegarle a la API.
- [AD.md](AD.md): cómo manejamos el AD desde la terminal con Azure CLI (prender el server, usuarios, claves, roles, horario). Tiene un glosario al final.
- [docs/PLAN.md](docs/PLAN.md): cómo está armado por dentro (SOLID, dominio, permisos, API, seguridad).
- [docs/DISENO.md](docs/DISENO.md): el diseño visual, que llamamos "Cielo".
- [docs/AD_SETUP.md](docs/AD_SETUP.md): cómo montamos el AD en Azure (y cómo sería en VirtualBox).

## Levantarlo

Desde la raíz:

```powershell
copy backend\.env.example backend\.env
copy backend\mock_users.example.json backend\mock_users.json
copy frontend\.env.example frontend\.env
npm run setup
cd backend; pipenv run seed; cd ..
npm run dev
```

`npm run dev` levanta el backend (`BE`) y el frontend (`FE`) en la misma terminal. Si se cae uno se cortan los dos. Se frena con `Ctrl+C`.

En `backend/.env` hay que poner algo largo y random en `JWT_SECRET`. Lo podés sacar con:

```powershell
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

Ojo: el `.env` se lee solo al arrancar, así que si lo tocás tenés que cortar y volver a correr `npm run dev`.

Queda la app en `http://localhost:5173`, la API en `http://localhost:8000/api` y el Swagger en `http://localhost:8000/docs`.

## Usuarios para probar

Con `AUTH_PROVIDER=mock` no hace falta el AD: usa los usuarios de `backend/mock_users.json` (`u.admin`, `u.operador`, `u.usuario` y `u.consulta`), con las claves que están ahí.

Para ir contra el AD de verdad, `AUTH_PROVIDER=ldap` y completar las `LDAP_*` como dice la sección 8 de `COMANDOS.md`.

## Cambiar la hora para probar

Como solo se puede entrar de 8 a 18, para probar a cualquier hora se puede fijar la hora en `backend/.env` (solo con `APP_ENV=development`):

```
CLOCK_OVERRIDE=2026-11-05T15:30:00   adentro del horario
CLOCK_OVERRIDE=2026-11-05T19:30:00   afuera
```

Arranca en esa hora y de ahí sigue corriendo. Vacío usa la hora real.

## Reloj para la presentación

Para mostrarla de noche sin andar tocando el `.env` armamos un reloj que se cambia desde la misma app:

1. En `backend/.env` poné `DEMO_RELOJ=true` (con `APP_ENV=development`) y reiniciá el backend. En producción no arranca con esto prendido.
2. Abajo a la izquierda aparece el botón **Demo · HH:MM**. Tiene atajos para 08:00, 12:00, 17:55 y 19:30, un campo para poner otra hora y **Hora real** para volver.
3. La hora que elijas vale para todo el backend: el horario, el login, las sesiones, el bloqueo por intentos y las fechas de los tickets. Desde ahí sigue avanzando.

Por ejemplo, a las 17:55 te avisa "Cierra en 5 min", y si pasás de 12:00 a 19:30 con la sesión abierta te dice "La jornada terminó". Si reiniciás el backend vuelve a `CLOCK_OVERRIDE` o a la hora real.

Solo cambia la hora, no el día. Si la presentación cae un fin de semana, poné un `CLOCK_OVERRIDE` en un día hábil y el reloj arranca de ahí. Los endpoints del reloj (`/api/demo/reloj`) no piden sesión porque se usan antes de loguearse, así que cuando no estés presentando dejá `DEMO_RELOJ=false` y desaparecen.

## Tests

```powershell
cd backend
pipenv run test
pipenv run lint
cd ..\frontend
npm run typecheck
npm run test
```

## Backend y frontend por separado

Si preferís dos terminales, el backend:

```powershell
cd backend
copy .env.example .env
copy mock_users.example.json mock_users.json
pipenv install --dev
pipenv run seed
pipenv run dev
```

Y el frontend:

```powershell
cd frontend
copy .env.example .env
npm install
npm run dev
```
