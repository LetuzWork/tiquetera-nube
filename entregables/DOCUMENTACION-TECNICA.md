# Tiquetera Nube: doc técnica

TP de Martin Laguna y Jeampierre Peralta.

La idea es simple: entrás con tu usuario del Active Directory, la app mira en qué grupos del AD estás y con eso te da un rol. Solo te deja entrar en el horario de atención. Los tickets se guardan en un JSON y se pueden exportar a CSV.

## Qué usamos

**Backend.** Python 3.12 con FastAPI. Elegimos FastAPI porque valida lo que entra sin que tengamos que escribir los chequeos a mano (con Pydantic) y además te arma la documentación de la API sola en `/docs`. Lo corremos con Uvicorn. Las dependencias las manejamos con pipenv (`backend/Pipfile`).

Otras librerías del backend:

- `ldap3` para hablar con el AD: buscar al usuario, probar su clave y leer sus grupos.
- `PyJWT` para el token de sesión, que va en una cookie que JavaScript no puede leer.
- `filelock` para que dos pedidos al mismo tiempo no pisen el JSON.
- `tzdata` para la zona horaria de Argentina.
- `pytest`, `httpx` y `ruff` para los tests y el estilo.

**Frontend.** React 18 con TypeScript, armado con Vite. Vite además le pasa las llamadas a `/api` al backend, así no hay que pelearse con CORS. La navegación es con React Router, los íconos con lucide-react y la fuente es Albert Sans (va empaquetada, no depende de internet). Los tests son con Vitest y Testing Library.

**El AD.** Un Windows Server 2022 en una VM de Azure, con el dominio `tpsnube.local`. Los roles son cuatro grupos: `GG-TQ-Admin`, `GG-TQ-Operador`, `GG-TQ-Usuario` y `GG-TQ-Consulta`. El firewall de Azure solo deja entrar al puerto de LDAPS desde nuestras IPs. Todo lo del servidor lo manejamos con Azure CLI (está en `AD.md`).

**Datos.** No hay base de datos: los tickets, con sus comentarios e historial, van a `backend/data/tickets.json`. La exportación es a CSV separado por `;` y en UTF-8 con BOM, para que Excel muestre bien los acentos.

**Para levantar todo junto** usamos Node 22 y `concurrently`, así `npm run dev` arranca backend y frontend a la vez.

## Cómo está armado

```
Navegador ──► React (Vite :5173) ──/api──► FastAPI (:8000) ──LDAPS :636──► Active Directory (Azure)
                                                 │
                                                 └──► backend/data/tickets.json
```

El backend está separado en capas, siguiendo SOLID:

- `domain`: los tickets, comentarios e historial, los estados y qué cambios de estado se permiten, y qué puede hacer cada rol.
- `ports`: las interfaces (autenticación, repositorio de tickets, exportador).
- `adapters`: las implementaciones de esas interfaces (LDAP, usuarios mock, el JSON y el CSV).
- `services`: la lógica: login, horario, tickets, reportes, pasar de grupos a rol y el bloqueo por intentos.
- `api`: las rutas y un contenedor que arma todo según la configuración.
- `core`: configuración, el reloj (el real o uno simulado para probar) y la sesión.

La ventaja es que si mañana queremos otra base de datos o dejar el AD, se agrega otro adaptador y los servicios no se tocan. Por ejemplo, los usuarios mock cumplen el mismo contrato que el LDAP, por eso podemos probar todo sin el servidor prendido. Ese modo solo anda en desarrollo.

## Cómo es el login

1. Primero se fija la hora. Si está fuera del horario te rebota con un 403 y ni consulta al AD.
2. Se conecta al AD por LDAPS con una cuenta de servicio que solo puede leer (`svc-tiquetera`) y busca tu usuario. Lo que escribiste se escapa antes de meterlo en la búsqueda, para que no se pueda inyectar nada.
3. Si la cuenta está deshabilitada, no entra. Si no, prueba tu clave conectándose al AD como vos.
4. Lee tus grupos (también los que están adentro de otros grupos) y te da el rol. Si no estás en ningún grupo de rol, te da 403.
5. Te da una sesión que dura 60 minutos o hasta que termina el horario, lo que pase primero.

En cada pedido el backend vuelve a chequear la sesión, el horario y el permiso. El frontend esconde los botones que tu rol no puede usar, pero la que manda es la validación del backend.

## Seguridad

- **Inyección LDAP:** todo lo que va a una búsqueda se escapa, y el usuario tiene que cumplir un formato (letras, números, punto, guion y guion bajo).
- **Inyección SQL:** no hay SQL. Los datos pasan por Pydantic y nunca se arma una consulta pegando texto.
- **Fórmulas en el CSV:** si una celda arranca con `=`, `+`, `-` o `@` le ponemos un `'` adelante, así Excel no la ejecuta.
- **Datos que entran:** cada campo tiene largo máximo, los valores posibles están cerrados y si mandás campos de más se rechaza.
- **La sesión:** la cookie es `HttpOnly` y `SameSite=Strict`, y en producción además `Secure`.
- **Fuerza bruta:** después de 5 intentos mal la app te bloquea un rato. El AD por su lado bloquea la cuenta 15 minutos.
- **Claves en el repo:** los `.env`, los certificados y los datos están en `.gitignore`. Solo subimos los `.env.example`.
- **La conexión con el AD:** va por LDAPS y se valida el certificado del servidor.

## Los datos

Todo vive en `backend/data/tickets.json`. Para arrancar con tickets de ejemplo está `pipenv run seed` (`backend/scripts/seed.py`). Cuando se guarda, se escribe primero un archivo temporal y después se reemplaza el original de una, así nunca queda a medio escribir. También se guarda una copia `tickets.json.bak`.

## Cómo correrlo

Con Python 3.12, pipenv y Node 22, desde la raíz:

```powershell
copy backend\.env.example backend\.env
copy backend\mock_users.example.json backend\mock_users.json
copy frontend\.env.example frontend\.env
npm run setup
cd backend; pipenv run seed; cd ..
npm run dev
```

La app queda en `http://localhost:5173` y la API en `http://localhost:8000/api`. Con `AUTH_PROVIDER=mock` anda sin AD. Para usar el AD de verdad: `AUTH_PROVIDER=ldap` y completar las `LDAP_*` (sección 8 de `COMANDOS.md` y `AD.md`).

Los tests: `cd backend; pipenv run test` y `cd frontend; npm run test`.
