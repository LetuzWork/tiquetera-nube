# Laboratorio de Active Directory en VirtualBox

Guía para montar el controlador de dominio contra el que autentica la Tiquetera Nube. Los scripts están en `scripts/ad/`.

## 1. Resultado esperado

| Dato | Valor |
|---|---|
| Dominio | `tiquetera.local` (NetBIOS `TIQUETERA`) |
| Controlador | `DC01` → `dc01.tiquetera.local` |
| IP del DC (red Host-Only) | `192.168.56.10` |
| LDAPS | `ldaps://dc01.tiquetera.local:636` con CA propia `Tiquetera-Root-CA` |
| Cuenta de servicio | `svc-tiquetera` (solo lectura, sin privilegios) |
| Grupos de rol | `GG-TQ-Admin`, `GG-TQ-Operador`, `GG-TQ-Usuario`, `GG-TQ-Consulta` |

Estructura del directorio:

```
DC=tiquetera,DC=local
└─ OU=Tiquetera
   ├─ OU=Usuarios    u.admin, u.operador, u.usuario, u.consulta, u.multi, u.sinrol, u.deshabilitado
   ├─ OU=Grupos      GG-TQ-Admin, GG-TQ-Operador, GG-TQ-Usuario, GG-TQ-Consulta
   └─ OU=Servicios   svc-tiquetera
```

| Usuario | Grupos | Para probar |
|---|---|---|
| `u.admin` | Admin | acceso completo |
| `u.operador` | Operador | gestión de tickets |
| `u.usuario` | Usuario | solo sus tickets |
| `u.consulta` | Consulta | solo lectura y reportes |
| `u.multi` | Usuario + Operador | gana el rol de mayor privilegio (Operador) |
| `u.sinrol` | — | credenciales válidas pero 403 por falta de rol |
| `u.deshabilitado` | Usuario | cuenta deshabilitada → rechazo |

## 2. Requisitos

- VirtualBox 7.x en el equipo anfitrión.
- ISO de **Windows Server 2022 Evaluation** (180 días, gratis desde Microsoft Evaluation Center).
- Recursos de la VM: 2 vCPU, 4 GB RAM (mínimo 2 GB), disco dinámico de 50 GB.

## 3. Crear la VM

1. **Nueva** → nombre `DC01-Tiquetera`, tipo Microsoft Windows, versión Windows 2022 (64-bit). Marcar *Skip Unattended Installation* para elegir la edición a mano.
2. Asignar 4096 MB, 2 CPU, disco VDI 50 GB.
3. **Red**:
   - Adaptador 1: **NAT** (salida a internet para actualizaciones).
   - Adaptador 2: **Adaptador sólo-anfitrión** → `VirtualBox Host-Only Ethernet Adapter` (red `192.168.56.0/24`). Si no existe: *Archivo → Herramientas → Administrador de red → Crear*, con DHCP deshabilitado o con rango que no incluya `.10`.
4. Montar el ISO e instalar **Windows Server 2022 Standard Evaluation (Desktop Experience)**.
5. Definir la contraseña del `Administrator` local.
6. *Dispositivos → Insertar imagen de Guest Additions* e instalarlas (portapapeles compartido para pegar los scripts).
7. Tomar **snapshot** `00-limpia`.

## 4. Copiar los scripts a la VM

Copiar la carpeta `scripts/ad/` a `C:\tiquetera\ad\` (carpeta compartida de VirtualBox o portapapeles). En PowerShell como Administrador:

```powershell
Set-ExecutionPolicy -Scope Process Bypass -Force
cd C:\tiquetera\ad
```

## 5. Ejecución paso a paso

| Paso | Comando | Qué hace | Reinicia |
|---|---|---|:-:|
| 1 | `.\01-preparar-servidor.ps1` | IP fija `192.168.56.10/24` en la Host-Only, DNS `127.0.0.1`, zona horaria Argentina, renombra a `DC01` | sí |
| 2 | `.\02-promover-dc.ps1` | instala AD DS + DNS y crea el bosque `tiquetera.local` (pide contraseña DSRM) | sí |
| — | snapshot `01-dc-promovido` | | |
| 3 | `.\03-poblar-directorio.ps1` | OUs, grupos, 7 usuarios de prueba y `svc-tiquetera` (pide ambas contraseñas) | no |
| 4 | `.\04-habilitar-ldaps.ps1` | instala AD CS como Enterprise Root CA, verifica certificado del DC y exporta `ad-ca.pem` | ver nota |
| — | snapshot `02-ldaps-listo` | | |

Nota paso 4: el DC obtiene su certificado por autoenrolamiento. Si el script avisa que todavía no existe, reiniciar la VM y correrlo de nuevo.

Después del paso 2 el login de Windows pasa a ser `TIQUETERA\Administrator`.

## 6. Preparar el equipo anfitrión

1. **Resolución de nombre**: el certificado LDAPS se emite para `dc01.tiquetera.local`, así que el host debe resolver ese nombre. Como Administrador, agregar al archivo `C:\Windows\System32\drivers\etc\hosts`:

   ```
   192.168.56.10   dc01.tiquetera.local   dc01
   ```

2. **Conectividad**:

   ```powershell
   Test-NetConnection dc01.tiquetera.local -Port 636
   ```

   Debe devolver `TcpTestSucceeded : True`.

3. **Certificado de la CA**: copiar `C:\tiquetera\ad-ca.pem` de la VM a `backend\certs\ad-ca.pem`.

4. **Variables** en `backend\.env` (partiendo de `.env.example`):

   ```
   AUTH_PROVIDER=ldap
   LDAP_URI=ldaps://dc01.tiquetera.local:636
   LDAP_CA_CERT_PATH=./certs/ad-ca.pem
   LDAP_BIND_PASSWORD=<contraseña de svc-tiquetera>
   ```

## 7. Verificación desde el host

Con el entorno del backend (`pipenv shell` en `backend/`):

```powershell
python -c "import ssl,ldap3;t=ldap3.Tls(validate=ssl.CERT_REQUIRED,ca_certs_file='certs/ad-ca.pem');s=ldap3.Server('dc01.tiquetera.local',port=636,use_ssl=True,tls=t);c=ldap3.Connection(s,'svc-tiquetera@tiquetera.local',input('clave svc: '),auto_bind=True);c.search('OU=Tiquetera,DC=tiquetera,DC=local','(objectClass=group)',attributes=['cn']);print([e.cn.value for e in c.entries])"
```

Salida esperada: `['GG-TQ-Admin', 'GG-TQ-Operador', 'GG-TQ-Usuario', 'GG-TQ-Consulta']`.

Pruebas funcionales con la app levantada:

| Usuario | Resultado esperado |
|---|---|
| `u.admin` / clave correcta | 200, rol Admin |
| `u.admin` / clave incorrecta | 401 "Credenciales inválidas" |
| `u.admin` / clave vacía | 422 (rechazo antes del bind anónimo) |
| `u.sinrol` | 403 "Sin rol asignado" |
| `u.deshabilitado` | 401 |
| `u.multi` | 200, rol Operador |
| `*)(objectClass=*` como usuario | 422 por validación + filtro escapado |
| cualquiera fuera de franja | 403 `FUERA_DE_HORARIO` sin contactar al AD |

## 8. Seguridad del laboratorio

- `svc-tiquetera` no pertenece a ningún grupo privilegiado; los usuarios autenticados ya tienen lectura sobre el directorio, que es lo único que necesita.
- La app nunca guarda contraseñas: solo hace bind con ellas y descarta.
- LDAP en 389 sin TLS no se usa; la app rechaza URIs `ldap://` fuera de `APP_ENV=development`.
- La red Host-Only aísla el DC: no queda expuesto a la LAN.
- Las contraseñas de laboratorio no se versionan; se piden con `Read-Host -AsSecureString`.

## 9. Problemas frecuentes

| Síntoma | Causa | Solución |
|---|---|---|
| `TcpTestSucceeded : False` al 636 | VM sin IP en Host-Only o AD CS no instalado | `ipconfig` en la VM; correr el paso 4 |
| `certificate verify failed` | PEM incorrecto o nombre distinto al del certificado | conectar por `dc01.tiquetera.local`, no por IP; reexportar CA |
| `invalidCredentials` con clave correcta | usar DN mal formado o UPN con sufijo erróneo | la app busca el DN real con la cuenta de servicio antes del bind |
| El DC no resuelve nombres externos | DNS apunta solo a `127.0.0.1` | DNS Manager → Reenviadores → `8.8.8.8` |
| Fin de evaluación | licencia de 180 días | `slmgr /rearm` o restaurar snapshot |
| Hora de la VM distinta del host | Guest Additions sincroniza con el host | la franja horaria la evalúa el backend con su propio reloj, no el DC |

## 10. Trabajar sin la VM

Mientras no haya VirtualBox disponible, usar `AUTH_PROVIDER=mock` con `APP_ENV=development` y copiar `mock_users.example.json` a `mock_users.json`. El proveedor mock respeta el mismo contrato que el LDAP (grupos, rol de mayor privilegio, mismos errores), por lo que el cambio a AD real es solo de variables de entorno.
