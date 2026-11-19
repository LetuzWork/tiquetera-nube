# El AD desde la terminal

Todo lo que hacemos con el AD de la ticketera lo hacemos desde PowerShell en la compu, con Azure CLI, sin tener que entrar al servidor: prenderlo y apagarlo, usuarios, claves, roles y el horario para loguearse.

| | |
|---|---|
| Servidor | `srv-ad`, IP pública `20.226.44.141`, grupo de recursos `rg-tps-nube` |
| Dominio | `tpsnube.local` (NetBIOS `TPSNUBE`) |
| Conexión de la app | `ldaps://20.226.44.141:636` |
| Firewall | `srv-adNSG`, reglas `LDAPS-mi-ip` (636) y `RDP-mi-ip` (3389) |
| Usuarios de la ticketera | `OU=Usuarios,OU=Tiquetera,DC=tpsnube,DC=local` |
| Cuenta de servicio | `svc-tiquetera`, solo lectura |
| Política de claves | mínimo 10 caracteres, tres tipos de caracteres; 5 claves incorrectas bloquean la cuenta 15 minutos |

Cómo lo armamos la primera vez está en la sección 8 de [COMANDOS.md](COMANDOS.md) y en [docs/AD_SETUP.md](docs/AD_SETUP.md).

## 1. Antes de arrancar (una sola vez)

Instalá Azure CLI y logueate. Si después de instalarlo la terminal de VS Code no reconoce `az`, cerrá VS Code entero y abrilo de nuevo.

```powershell
winget install --id Microsoft.AzureCLI -e
az login
```

Después armamos un atajo, `ad`: le pasás un comando y lo corre en el servidor. Pegalo una vez y abrí una terminal nueva.

```powershell
New-Item -ItemType File -Force $PROFILE | Out-Null
Add-Content $PROFILE @'
function ad {
  param([Parameter(Mandatory)][string]$Script)
  $f = Join-Path $env:TEMP "ad-$([guid]::NewGuid()).ps1"
  Set-Content $f $Script -Encoding utf8
  try { az vm run-command invoke -g rg-tps-nube -n srv-ad --command-id RunPowerShellScript --scripts "@$f" --query "value[0].message" -o tsv }
  finally { Remove-Item $f -ErrorAction SilentlyContinue }
}
'@
```

Para ver que anda:

```powershell
ad 'Get-ADDomain | Select-Object DNSRoot, NetBIOSName'
```

- Cada llamada tarda entre 20 y 40 segundos, paciencia. Lo que sale abajo de `[stdout]` es el resultado y lo de `[stderr]` son errores.
- El comando va entre comillas simples `'...'`, así PowerShell no se mete con los `$`. Si son varias líneas va `ad @' ... '@`, y el `'@` del final tiene que estar pegado al principio de la línea.
- Si sale `(Conflict) Run command extension execution is in progress` es que Azure todavía está con el comando anterior (corre uno por vez). Esperá un minuto y volvé a probar. Cortarlo con Ctrl+C no sirve, en Azure sigue corriendo igual.
- Si PowerShell dice que los scripts están deshabilitados, corré `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` y abrí otra terminal.

## 2. El servidor

```powershell
az vm show -g rg-tps-nube -n srv-ad -d --query powerState -o tsv   # ver si está prendido
az vm start      -g rg-tps-nube -n srv-ad
az vm deallocate -g rg-tps-nube -n srv-ad                         # apagar sin que siga cobrando
az vm restart    -g rg-tps-nube -n srv-ad
```

Para apagarlo usá `deallocate`. Con `stop` Azure te sigue reservando la máquina y te la cobra.

### Abrir el firewall a tu IP actual

Hace falta cuando cambiás de red o el proveedor te cambia la IP. Pisa la IP que estaba cargada.

```powershell
$ip = Invoke-RestMethod https://api.ipify.org
foreach ($r in "LDAPS-mi-ip","RDP-mi-ip") {
  az network nsg rule update -g rg-tps-nube --nsg-name srv-adNSG -n $r --source-address-prefixes $ip -o none
}
"Firewall abierto para $ip"
```

Si querés dejar varias, ponelas todas separadas por espacio: `--source-address-prefixes IP_1 IP_2`. Las otras compus de tu misma red salen con la misma IP pública, así que no hace falta agregarlas.

### Apagado automático

Azure toma la hora en UTC, que va 3 horas adelante nuestro. O sea, a la hora que quieras sumale 3: las 23 de acá son `0200`. Ahora está en `0500`, que son las 2 de la mañana de acá.

```powershell
az resource show -g rg-tps-nube -n shutdown-computevm-srv-ad --resource-type Microsoft.DevTestLab/schedules --query "properties.{hora:dailyRecurrence.time,zona:timeZoneId,estado:status}" -o table
az vm auto-shutdown -g rg-tps-nube -n srv-ad --time 0200   # apagar a las 23:00 de Argentina
az vm auto-shutdown -g rg-tps-nube -n srv-ad --off         # desactivarlo
```

| Que se apague a las (hora de acá) | `--time` |
|---|---|
| 20:00 | `2300` |
| 22:00 | `0100` |
| 23:00 | `0200` |
| 00:00 | `0300` |

### Poner el servidor en hora de acá

El servidor está en UTC, así que las fechas que muestra el AD (último login, intentos fallidos) salen 3 horas corridas. No afecta en nada al horario de la sección 6, es solo para que las fechas se lean bien.

```powershell
ad 'Set-TimeZone -Id "Argentina Standard Time"; Get-TimeZone; Get-Date'
```

## 3. Ver usuarios y roles

Todos los usuarios de la ticketera, con su estado y sus grupos:

```powershell
ad @'
Get-ADUser -SearchBase "OU=Usuarios,OU=Tiquetera,DC=tpsnube,DC=local" -Filter * -Properties Enabled,LockedOut,LastLogonDate,MemberOf |
  Select-Object SamAccountName, Enabled, LockedOut, LastLogonDate,
    @{n="Grupos";e={($_.MemberOf | ForEach-Object { ($_ -split ",")[0] -replace "CN=" }) -join ", "}} |
  Format-Table -AutoSize | Out-String -Width 200
'@
```

Quién está en cada rol:

```powershell
ad @'
"GG-TQ-Admin","GG-TQ-Operador","GG-TQ-Usuario","GG-TQ-Consulta" | ForEach-Object {
  "{0}: {1}" -f $_, ((Get-ADGroupMember $_ | Select-Object -ExpandProperty SamAccountName) -join ", ")
}
'@
```

Todo sobre un usuario, incluidos los intentos fallidos:

```powershell
ad 'Get-ADUser u.usuario -Properties * | Select-Object SamAccountName, DisplayName, Enabled, LockedOut, BadLogonCount, LastBadPasswordAttempt, LastLogonDate, PasswordLastSet, logonHours, MemberOf | Format-List'
```

Y lo mismo pero como lo ve la app (usa la cuenta de servicio, igual que el login):

```powershell
cd backend; pipenv run probar-ldap; cd ..
```

## 4. Usuarios

La app solo busca usuarios en `OU=Usuarios,OU=Tiquetera`. Si creás uno en otra carpeta no va a poder entrar.

### Crear un usuario

Te pide la clave en la terminal. Antes de correrlo cambiá `u.nuevo` y el nombre. Después acordate de darle un rol (sección 5), porque sin rol le da 403 al loguearse.

```powershell
$clave = Read-Host "Clave para el usuario nuevo"
ad @"
New-ADUser -SamAccountName 'u.nuevo' -UserPrincipalName 'u.nuevo@tpsnube.local' ``
  -Name 'Nombre Apellido' -GivenName 'Nombre' -Surname 'Apellido' -DisplayName 'Nombre Apellido' ``
  -EmailAddress 'u.nuevo@tpsnube.local' ``
  -Path 'OU=Usuarios,OU=Tiquetera,DC=tpsnube,DC=local' ``
  -AccountPassword (ConvertTo-SecureString '$clave' -AsPlainText -Force) ``
  -PasswordNeverExpires `$true -Enabled `$true
'creado'
"@
```

Este va con comillas dobles `@"` para poder meter la clave, por eso los `$true` y los saltos de línea llevan una comilla invertida adelante.

### Cambiar la clave

```powershell
$clave = Read-Host "Clave nueva"
ad "Set-ADAccountPassword u.usuario -Reset -NewPassword (ConvertTo-SecureString '$clave' -AsPlainText -Force); Unlock-ADAccount u.usuario; 'ok'"
```

Ojo que la clave no puede tener comillas simples `'`.

### Volver a las claves de los usuarios mock

Les pone a `u.admin`, `u.operador`, `u.usuario` y `u.consulta` la clave que tienen en `backend/mock_users.example.json` y de paso los desbloquea. Desde la raíz del repo:

```powershell
npm run ad:claves-mock
node scripts/ad/resetear-claves-mock.mjs otro-archivo.json   # con otro archivo
```

`u.multi`, `u.sinrol` y `u.deshabilitado` no están en ese archivo, así que siguen con la clave de `credenciales-prueba.local.txt`.

### Desbloquear, deshabilitar, habilitar, editar, borrar

```powershell
ad 'Unlock-ADAccount u.usuario; "desbloqueado"'
ad 'Disable-ADAccount u.usuario; "deshabilitado"'
ad 'Enable-ADAccount u.usuario; "habilitado"'
ad 'Set-ADUser u.usuario -DisplayName "Ana Gómez" -EmailAddress "ana@tpsnube.local"; "ok"'
ad 'Remove-ADUser u.nuevo -Confirm:$false; "borrado"'   # no se puede deshacer
```

## 5. Roles y permisos

El rol en la app sale de los grupos del AD. Para cambiarle el permiso a alguien lo sacás o lo metés en un grupo, y vale desde la próxima vez que se loguea.

| Grupo del AD | Rol | Qué puede hacer |
|---|---|---|
| `GG-TQ-Admin` | Admin | todo, incluido reabrir tickets cerrados |
| `GG-TQ-Operador` | Operador | ver todos, asignar, cambiar estado, comentar, reportes |
| `GG-TQ-Usuario` | Usuario | crear y ver solo sus tickets, comentar |
| `GG-TQ-Consulta` | Consulta | ver todo y reportes, sin modificar |
| ninguno | — | credenciales válidas, pero 403 |

Si está en más de un grupo, la app se queda con el primero en este orden: Admin, Operador, Usuario, Consulta.

```powershell
ad 'Add-ADGroupMember GG-TQ-Operador -Members u.usuario; "ok"'                    # dar un rol
ad 'Remove-ADGroupMember GG-TQ-Operador -Members u.usuario -Confirm:$false; "ok"' # quitar un rol
```

Para cambiarlo de rol (lo saca de todos y lo pone en uno):

```powershell
ad @'
$u = "u.usuario"; $nuevo = "GG-TQ-Consulta"
"GG-TQ-Admin","GG-TQ-Operador","GG-TQ-Usuario","GG-TQ-Consulta" | ForEach-Object { Remove-ADGroupMember $_ -Members $u -Confirm:$false -ErrorAction SilentlyContinue }
Add-ADGroupMember $nuevo -Members $u
"$u ahora es $nuevo"
'@
```

`svc-tiquetera` no está en ningún grupo con privilegios, solo lee. No la metas en grupos de administración.

## 6. Bloqueo horario

El horario se puede limitar en dos lados:

| Dónde | Estado | Cómo funciona |
|---|---|---|
| En la app | activo | El backend mira la hora antes de consultar el AD y fuera de la franja responde 403 "Ventanilla cerrada". Igual para todos. Se configura en `backend/.env` con `ACCESS_WINDOW_START`, `ACCESS_WINDOW_END` y `ACCESS_DAYS`. |
| En el AD | sin cargar | Cada usuario puede tener sus horas de inicio de sesión (`logonHours`). Fuera de ellas el AD rechaza la clave aunque sea correcta, en la ticketera y en cualquier sistema del dominio. Sirve para horarios distintos por persona. |

Para cargarle horario a un usuario (acá, lunes a viernes de 8 a 18). En la última línea los días van de 1 (lunes) a 7 (domingo) y las horas de 0 a 24:

```powershell
ad @'
function Set-Horario($u, [int[]]$dias = 1..5, [int]$desde = 8, [int]$hasta = 18) {
  $b = New-Object byte[] 21
  foreach ($d in $dias) { for ($h = $desde; $h -lt $hasta; $h++) {
    $p = (($d % 7) * 24 + $h + 3) % 168
    $b[[int][math]::Floor($p / 8)] = $b[[int][math]::Floor($p / 8)] -bor (1 -shl ($p % 8))
  } }
  Set-ADUser $u -Replace @{ logonHours = $b }
  "horario cargado en $u"
}
Set-Horario u.usuario 1..5 8 18
'@
```

El AD guarda las horas en UTC; el `+ 3` es lo que pasa de nuestra hora a UTC, así que da igual en qué zona horaria esté el servidor. Otros ejemplos: `Set-Horario u.consulta 1..6 9 13` (lunes a sábado de 9 a 13) o `Set-Horario u.operador 1..7 0 24` (siempre).

Para ver qué horario tiene alguien (en hora de acá):

```powershell
ad @'
$b = (Get-ADUser u.usuario -Properties logonHours).logonHours
if (-not $b) { "sin restriccion horaria" } else {
  $n = "Dom","Lun","Mar","Mie","Jue","Vie","Sab"
  0..6 | ForEach-Object { $d = $_
    $hs = 0..23 | Where-Object { $p = ($d * 24 + $_ + 3) % 168; $b[[int][math]::Floor($p / 8)] -band (1 -shl ($p % 8)) }
    "{0}: {1}" -f $n[$d], ($hs -join ",") }
}
'@
```

Para sacárselo:

```powershell
ad 'Set-ADUser u.usuario -Clear logonHours; "sin restriccion"'
```

Un detalle: si alguien intenta entrar fuera de su horario del AD, la app le dice "Credenciales inválidas", porque el AD rechaza la clave sin explicar por qué. El cartel de "Ventanilla cerrada" sale solo con el horario de la app. Y si ya tenía la sesión abierta, le sigue andando hasta que vence (60 minutos).

## 7. Si el login no anda

| Si te pasa esto | Probá esto |
|---|---|
| Error 503 "directorio no disponible" | El servidor está apagado o te cambió la IP. `az vm start` y abrí el firewall (sección 2). |
| `Test-NetConnection 20.226.44.141 -Port 636` da False | Lo mismo. Después de prenderlo dale un minuto. |
| "Credenciales inválidas" con la clave bien | Mirá `BadLogonCount` y `LockedOut` del usuario (sección 3). Si está bloqueado, `Unlock-ADAccount`. Fijate también que la clave sea la de `mock_users.example.json`. |
| "Demasiados intentos" (429) | Es la app la que te bloqueó, no el AD. Se destraba reiniciando `npm run dev`. |
| "Ventanilla cerrada" | Mirá `CLOCK_OVERRIDE` en `backend/.env`. |

## Glosario

Por si alguna palabra de los comandos no te suena.

### Cómo se lee un comando

`az vm run-command invoke -g rg-tps-nube -n srv-ad --command-id RunPowerShellScript --scripts "@archivo.ps1" --query "value[0].message" -o tsv`

1. `az`: el programa, Azure CLI.
2. `vm run-command invoke`: sobre una máquina virtual, ejecutar un comando adentro.
3. `-g rg-tps-nube`: en qué grupo de recursos está.
4. `-n srv-ad`: cómo se llama la máquina.
5. `--command-id RunPowerShellScript`: lo que va a correr es PowerShell.
6. `--scripts "@archivo.ps1"`: el script; la `@` significa "leelo de este archivo".
7. `--query "value[0].message"`: de toda la respuesta, mostrar solo el texto de salida.
8. `-o tsv`: en texto plano.

`Get-ADUser u.usuario -Properties MemberOf | Select-Object SamAccountName, MemberOf`

1. `Get-ADUser`: verbo-sustantivo, "traer un usuario del AD".
2. `u.usuario`: a quién.
3. `-Properties MemberOf`: además de lo básico, traer sus grupos.
4. `|`: pasar el resultado al comando siguiente.
5. `Select-Object ...`: mostrar solo esas columnas.

### Azure

| Palabra | Qué es |
|---|---|
| `az` | Azure CLI: todo lo que se hace en el portal con clics, desde la terminal |
| `az login` | inicia sesión con tu cuenta; queda guardado |
| `vm` | máquina virtual, una compu en los servidores de Microsoft |
| `-g` / `--resource-group` | grupo de recursos: la carpeta de Azure con todo lo del proyecto. Borrarlo borra todo |
| `-n` / `--name` | nombre del recurso |
| `start` / `restart` | prender / reiniciar |
| `deallocate` | apagar y liberar el hardware; deja de cobrar el procesamiento |
| `stop` | apaga Windows pero Azure sigue reservando y cobrando la máquina |
| `-d` / `--show-details` | agrega datos en vivo, como el estado y la IP |
| `powerState` | `VM running`, `VM deallocated` (apagada sin cobrar), `VM stopped` (apagada cobrando) |
| `run-command invoke` | ejecuta un script dentro de la VM sin conectarse; es lo que usa `ad` |
| `RunPowerShellScript` | indica que el script es PowerShell |
| `--scripts "@archivo"` | el script a ejecutar, leído de un archivo |
| `auto-shutdown` | apagado automático diario |
| `--time 0200` | hora del apagado, HHMM en UTC |
| `--off` | desactiva el apagado automático |
| `nsg` | Network Security Group, el firewall de la VM |
| `nsg rule` | regla del firewall: qué puerto se abre y desde qué IPs |
| `--source-address-prefixes` | desde qué IPs se permite entrar; al actualizar reemplaza la lista |
| `az resource show` | muestra cualquier recurso de Azure |
| `--query` | filtra la respuesta (lenguaje JMESPath: `properties.status` es "status dentro de properties") |
| `-o` / `--output` | formato: `tsv` texto plano, `table` tabla, `json` completo, `none` nada |
| UTC | hora universal; Argentina está 3 horas atrás |

### Red y conexión

| Palabra | Qué es |
|---|---|
| IP pública | la dirección con la que tu red sale a internet; es la que va en el firewall y puede cambiar sola |
| IP de LAN | la dirección de tu compu dentro de tu red (192.168.x.x) |
| puerto | número del servicio: 636 LDAPS, 3389 escritorio remoto, 8000 backend, 5173 frontend |
| LDAP | protocolo para consultar el AD: buscar usuarios, leer grupos, verificar claves |
| LDAPS | LDAP cifrado, puerto 636; es lo que usa la app |
| bind | "iniciar sesión" en LDAP; la app hace bind con la clave del usuario para comprobarla |
| `ad-ca.pem` | certificado que permite a la app comprobar que habla con el AD verdadero |
| RDP | escritorio remoto, puerto 3389 |
| `Test-NetConnection` | prueba si llegás a una IP y un puerto; `TcpTestSucceeded : True` es que sí |
| `Invoke-RestMethod` | pide una dirección web; con `api.ipify.org` devuelve tu IP pública |

### Active Directory

| Palabra | Qué es |
|---|---|
| AD | el directorio de Microsoft con los usuarios, claves y grupos |
| dominio | el nombre del directorio: `tpsnube.local` (corto: `TPSNUBE`) |
| DC (controlador de dominio) | el servidor que tiene el AD: `srv-ad` |
| OU | unidad organizativa, una carpeta dentro del AD |
| DN | la ruta completa de algo, de adentro hacia afuera: `CN=svc-tiquetera,OU=Servicios,OU=Tiquetera,DC=tpsnube,DC=local` |
| CN | el nombre del objeto dentro del DN |
| `DC=` en un DN | cada parte del dominio: `DC=tpsnube,DC=local` es `tpsnube.local` |
| SamAccountName | el nombre de usuario corto, el del login: `u.admin` |
| UserPrincipalName (UPN) | el usuario en forma de mail: `u.admin@tpsnube.local` |
| DisplayName | el nombre que se muestra |
| grupo / `GG-` | lista de usuarios; cada `GG-TQ-*` es un rol. `GG` = grupo global |
| MemberOf | los grupos donde está un usuario |
| cuenta de servicio | usuario que usa un programa, no una persona: `svc-tiquetera` |
| Enabled | si la cuenta está habilitada |
| LockedOut | si está bloqueada por claves incorrectas |
| BadLogonCount | cuántas claves incorrectas lleva seguidas |
| LastLogonDate | último login, aproximado (se actualiza con hasta 14 días de demora) |
| PasswordNeverExpires | la clave no vence |
| logonHours | horas de la semana en que puede iniciar sesión: 21 bytes, un bit por hora, en UTC |

### Comandos del AD

| Comando u opción | Qué hace |
|---|---|
| `Get-ADUser` / `New-ADUser` / `Set-ADUser` / `Remove-ADUser` | traer / crear / cambiar / borrar usuarios |
| `Set-ADAccountPassword -Reset` | poner una clave sin pedir la anterior |
| `Unlock-ADAccount` | desbloquear |
| `Enable-ADAccount` / `Disable-ADAccount` | habilitar / deshabilitar |
| `Get-ADGroupMember` | quiénes están en un grupo |
| `Add-ADGroupMember` / `Remove-ADGroupMember` | dar / quitar un rol |
| `Get-ADDomain` | datos del dominio |
| `-Identity` | a quién se aplica; se puede omitir la palabra |
| `-Members` | usuarios a agregar o sacar de un grupo |
| `-Properties` | datos extra a traer; `*` trae todos |
| `-Filter *` | traer todos |
| `-SearchBase` / `-Path` | en qué OU buscar / en qué OU crear |
| `-Replace @{ ... }` / `-Clear` | reemplazar / borrar el valor de una propiedad |
| `-Confirm:$false` | no preguntar "¿estás seguro?"; hace falta porque nadie puede responder |
| `-ErrorAction SilentlyContinue` | si da error, seguir sin mostrarlo |
| `ConvertTo-SecureString -AsPlainText -Force` | convierte una clave escrita al formato que piden los comandos de claves |
| `Set-TimeZone` | cambia la zona horaria |

### PowerShell

| Palabra | Qué es |
|---|---|
| Verbo-Sustantivo | `Get` traer, `Set` cambiar, `New` crear, `Remove` borrar, `Add` agregar |
| `\|` | pasa el resultado al comando siguiente |
| `$variable` | guarda un valor; `$_` es el elemento actual dentro de `ForEach-Object` o `Where-Object` |
| `$true` / `$false` | verdadero / falso |
| `;` | separa dos comandos en una línea |
| `'simples'` / `"dobles"` | texto tal cual / texto donde las `$variables` se reemplazan |
| `@' ... '@` / `@" ... "@` | lo mismo, pero de varias líneas |
| `` ` `` | al final de línea: sigue abajo. Adelante de `$`: no reemplazar |
| `@{ clave = valor }` | tabla de pares nombre-valor |
| `1..5` | los números del 1 al 5 |
| `function` / `param(...)` | define un comando propio / los datos que recibe |
| `try` / `finally` | hacer algo y, salga bien o mal, después hacer lo de `finally` |
| `$PROFILE` | archivo que PowerShell lee al abrir cada terminal; ahí vive `ad` |
| `$env:TEMP` | carpeta de archivos temporales |
| `Read-Host` | pide que escribas algo |
| `Get-Content` / `Set-Content` / `Add-Content` | leer / escribir / agregar a un archivo; `-Raw` lee todo junto |
| `Select-Object` | elegir columnas; `@{n="...";e={...}}` es una columna calculada |
| `Format-Table` / `Format-List` | mostrar como tabla / como lista |
| `Out-String -Width 200` | convierte la tabla en texto ancho para que no se corte |
| `ForEach-Object` / `Where-Object` | hacer algo con cada elemento / quedarse con los que cumplen algo |
| `-join` / `-split` | unir una lista en un texto / cortar un texto |
| `-bor` / `-band` / `-shl` | operaciones con bits, solo para `logonHours` |
| `Set-ExecutionPolicy` | permite ejecutar scripts como tu perfil |
| `Out-Null` | descarta la salida |
