# Comandos de Tiquetera Nube

Acá juntamos todo lo que hay que correr para instalar, levantar, probar y usar la ticketera, más lo del Active Directory en Azure. Es todo PowerShell en Windows, menos lo de Cloud Shell, que es bash.

## 1. Requisitos

| Herramienta | Versión probada | Para qué |
|---|---|---|
| Python | 3.12 | backend |
| pipenv | 2026.x | entorno virtual del backend (`pip install --user pipenv`) |
| Node.js | 22 | frontend y el script que levanta todo junto |
| Git | cualquiera | clonar el repo |

## 2. Primera vez

Desde la raíz del repo:

```powershell
git clone https://github.com/LetuzWork/tiquetera-nube.git
cd tiquetera-nube
copy backend\.env.example backend\.env
copy backend\mock_users.example.json backend\mock_users.json
copy frontend\.env.example frontend\.env
npm run setup
cd backend; pipenv run seed; cd ..
```

Generar el secreto de las sesiones y pegarlo en `JWT_SECRET` de `backend\.env`:

```powershell
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

`npm run setup` instala `concurrently` en la raíz, las dependencias de Python con pipenv y las del frontend con npm. `pipenv run seed` carga 5 tickets de ejemplo en `backend\data\tickets.json`.

## 3. Levantar la app

```powershell
npm run dev
```

| Qué | Dónde |
|---|---|
| App | http://localhost:5173 |
| API | http://localhost:8000/api |
| Documentación interactiva de la API (Swagger) | http://localhost:8000/docs |

Levanta backend (prefijo `BE`) y frontend (prefijo `FE`) en la misma terminal. Se corta con `Ctrl+C`. Cualquier cambio en `backend\.env` necesita cortar y volver a correr `npm run dev`.

Para tirar todo y volver a levantarlo (aunque haya quedado colgado en otra terminal):

```powershell
Get-NetTCPConnection -LocalPort 8000,5173 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { taskkill /PID $_.OwningProcess /T /F }; npm run dev
```

Por separado, en dos terminales:

```powershell
cd backend; pipenv run dev
cd frontend; npm run dev
```

## 4. Elegir contra qué autentica

En `backend\.env`:

| Variable | Valor | Efecto |
|---|---|---|
| `AUTH_PROVIDER` | `mock` | usuarios de `backend\mock_users.json`, sin AD. Solo funciona con `APP_ENV=development` |
| `AUTH_PROVIDER` | `ldap` | autentica contra el Active Directory de Azure por LDAPS |

Usuarios de prueba, iguales en mock y en el AD:

| Usuario | Rol | Qué puede hacer |
|---|---|---|
| `u.admin` | Admin | todo, incluido reabrir tickets cerrados |
| `u.operador` | Operador | ver todos, asignar, cambiar estado, comentar, reportes |
| `u.usuario` | Usuario | crear y ver solo sus tickets, comentar |
| `u.consulta` | Consulta | ver todo y reportes, sin modificar nada |
| `u.multi` | Usuario + Operador | queda como Operador (gana el de más privilegio) |
| `u.sinrol` | ninguno | credenciales válidas pero 403 |
| `u.deshabilitado` | Usuario | cuenta deshabilitada, se rechaza |

Las claves del modo mock están en `backend\mock_users.json`. Las del AD salen del script de la sección 8 y se guardan en `credenciales-prueba.local.txt`, que no se sube a git.

## 5. Simular la hora (restricción horaria)

Se puede entrar de lunes a viernes de 8 a 18, hora de acá (`ACCESS_WINDOW_START`, `ACCESS_WINDOW_END`, `ACCESS_DAYS`). Para probar a cualquier hora, en `backend\.env`:

```
CLOCK_OVERRIDE=2026-11-10T10:00:00     dentro de la franja
CLOCK_OVERRIDE=2026-11-10T19:30:00     ventanilla cerrada
CLOCK_OVERRIDE=                        reloj real
```

Reiniciar `npm run dev` después de cambiarlo. Solo se acepta con `APP_ENV=development`.

## 6. Usar la API desde PowerShell

Login, guardando la cookie de sesión en `$s`:

```powershell
$s = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$cred = @{ usuario = "u.operador"; password = (Read-Host "Clave") } | ConvertTo-Json
Invoke-RestMethod http://localhost:8000/api/auth/login -Method Post -Body $cred -ContentType "application/json" -WebSession $s
```

Con la sesión abierta:

```powershell
$api = "http://localhost:8000/api"
Invoke-RestMethod "$api/auth/me" -WebSession $s
Invoke-RestMethod "$api/auth/horario"
Invoke-RestMethod "$api/tickets?estado=ABIERTO&prioridad=ALTA" -WebSession $s
Invoke-RestMethod "$api/tickets/6" -WebSession $s

$nuevo = @{ titulo = "No anda el mouse"; descripcion = "El mouse de la PC 12 no responde"; categoria = "Hardware"; prioridad = "MEDIA" } | ConvertTo-Json
Invoke-RestMethod "$api/tickets" -Method Post -Body $nuevo -ContentType "application/json; charset=utf-8" -WebSession $s

Invoke-RestMethod "$api/tickets/7/asignacion" -Method Post -Body '{"responsable":"u.operador"}' -ContentType "application/json" -WebSession $s
Invoke-RestMethod "$api/tickets/7/estado" -Method Post -Body '{"estado":"EN_PROGRESO"}' -ContentType "application/json" -WebSession $s
Invoke-RestMethod "$api/tickets/7/comentarios" -Method Post -Body '{"texto":"Lo cambio en un rato"}' -ContentType "application/json" -WebSession $s
Invoke-RestMethod "$api/tickets/7" -Method Patch -Body '{"prioridad":"ALTA"}' -ContentType "application/json" -WebSession $s

Invoke-RestMethod "$api/usuarios/responsables" -WebSession $s
Invoke-RestMethod "$api/reportes/resumen?desde=2026-11-01&hasta=2026-11-30" -WebSession $s
Invoke-WebRequest "$api/reportes/export/tickets.csv?estado=RESUELTO" -WebSession $s -OutFile tickets.csv
Invoke-WebRequest "$api/reportes/export/historial.csv" -WebSession $s -OutFile historial.csv

Invoke-RestMethod "$api/auth/logout" -Method Post -Body "{}" -ContentType "application/json" -WebSession $s
```

| Estado | Valores |
|---|---|
| estado | `ABIERTO`, `EN_PROGRESO`, `RESUELTO`, `CERRADO` |
| prioridad | `BAJA`, `MEDIA`, `ALTA`, `CRITICA` |
| categoria | `Hardware`, `Software`, `Red`, `Accesos`, `Otro` |

Códigos de error que devuelve la API: 401 credenciales inválidas o sesión vencida, 403 fuera de horario o sin permiso, 404 ticket inexistente o ajeno, 409 transición de estado inválida o ticket cerrado, 422 datos inválidos, 429 demasiados intentos de login, 503 el AD no responde.

## 7. Tests y calidad

```powershell
cd backend
pipenv run test
pipenv run lint
cd ..\frontend
npm run typecheck
npm run build
```

Un solo archivo de tests: `pipenv run pytest tests/test_api.py -q`.

## 8. Active Directory en Azure (una sola vez)

El dominio es `tpsnube.local` y vive en la VM `srv-ad` (grupo de recursos `rg-tps-nube`, IP pública 20.226.44.141). Con estos pasos creamos los usuarios y grupos de la ticketera, la cuenta de servicio y el certificado para LDAPS.

1. Entrar a https://shell.azure.com (Bash).
2. Administrar archivos, Cargar, y subir estos tres archivos del repo:
   `scripts/azure/preparar-ad-azure.sh`, `scripts/ad/03-poblar-directorio.ps1`, `scripts/ad/04-habilitar-ldaps.ps1`
3. Acomodarlos y correr:

```bash
mkdir -p ~/tq/scripts/azure ~/tq/scripts/ad
mv ~/preparar-ad-azure.sh ~/tq/scripts/azure/
mv ~/03-poblar-directorio.ps1 ~/04-habilitar-ldaps.ps1 ~/tq/scripts/ad/
bash ~/tq/scripts/azure/preparar-ad-azure.sh
```

El script prende la VM si está apagada, abre el 636 solo para tu IP, crea en el AD la OU `Tiquetera` con los grupos `GG-TQ-*`, los 7 usuarios de prueba y `svc-tiquetera` con claves al azar, arma el certificado de LDAPS y te deja todo en `~/tiquetera-salida`.

4. Administrar archivos, Descargar:
   `tiquetera-salida/ad-ca.pem` va a `backend\certs\ad-ca.pem`
   `tiquetera-salida/claves.txt` tiene las dos claves generadas
5. En `backend\.env`:

```
AUTH_PROVIDER=ldap
LDAP_URI=ldaps://20.226.44.141:636
LDAP_CA_CERT_PATH=./certs/ad-ca.pem
LDAP_TLS_NOMBRE=srv-ad.tpsnube.local
LDAP_BIND_PASSWORD=<CLAVE_SVC_TIQUETERA de claves.txt>
```

6. Guardar `CLAVE_USUARIOS_LAB` en `credenciales-prueba.local.txt` en la raíz del repo (ignorado por git). Es la clave de los 7 usuarios `u.*`.
7. Probar la conexión sin levantar la app:

```powershell
cd backend
pipenv run probar-ldap
pipenv run probar-ldap u.admin
```

El primero te muestra quién está en cada grupo de rol, usando la cuenta de servicio. El segundo además te pide la clave de `u.admin` y prueba el login entero.

## 9. Azure del día a día

Todo lo del día a día (prender y apagar el servidor, abrir el firewall a tu IP, el apagado automático, usuarios, claves, roles y horario) lo hacemos desde PowerShell con Azure CLI. Está en [AD.md](AD.md).

Lo que más usamos:

```powershell
az vm start -g rg-tps-nube -n srv-ad
az vm deallocate -g rg-tps-nube -n srv-ad
npm run ad:claves-mock
```

## 10. Si algo falla

| Síntoma | Qué hacer |
|---|---|
| `npm run dev` dice que el puerto 8000 o 5173 está ocupado | `Get-NetTCPConnection -LocalPort 8000 -State Listen` y cerrar ese proceso |
| La app abre en blanco | esperar a que el backend diga `Application startup complete` y recargar |
| Ventanilla cerrada todo el tiempo | revisar `CLOCK_OVERRIDE` y la hora de la compu |
| Error 503 "directorio no disponible" al loguear | VM apagada, IP cambiada (sección 9) o clave de `svc-tiquetera` mal en `.env` |
| `certificate verify failed` | falta `backend\certs\ad-ca.pem` o `LDAP_TLS_NOMBRE` no es `srv-ad.tpsnube.local` |
| `Credenciales inválidas` con la clave correcta | la cuenta está bloqueada por intentos: `Unlock-ADAccount` en el servidor |
| Cambié `.env` y no pasa nada | cortar y volver a correr `npm run dev` |
