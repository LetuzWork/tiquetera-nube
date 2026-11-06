param(
    [string]$BaseDN = "DC=tiquetera,DC=local",
    [string]$SufijoUPN = "tiquetera.local"
)

$ErrorActionPreference = "Stop"
Import-Module ActiveDirectory

$claveLab = Read-Host -AsSecureString "Contraseña para los usuarios de laboratorio"
$claveServicio = Read-Host -AsSecureString "Contraseña para svc-tiquetera"

$ouRaiz = "OU=Tiquetera,$BaseDN"
$ouUsuarios = "OU=Usuarios,$ouRaiz"
$ouGrupos = "OU=Grupos,$ouRaiz"
$ouServicios = "OU=Servicios,$ouRaiz"

function Asegurar-OU([string]$Nombre, [string]$Padre) {
    if (-not (Get-ADOrganizationalUnit -Filter "Name -eq '$Nombre'" -SearchBase $Padre -SearchScope OneLevel -ErrorAction SilentlyContinue)) {
        New-ADOrganizationalUnit -Name $Nombre -Path $Padre -ProtectedFromAccidentalDeletion $true
    }
}

Asegurar-OU "Tiquetera" $BaseDN
Asegurar-OU "Usuarios" $ouRaiz
Asegurar-OU "Grupos" $ouRaiz
Asegurar-OU "Servicios" $ouRaiz

$grupos = @("GG-TQ-Admin", "GG-TQ-Operador", "GG-TQ-Usuario", "GG-TQ-Consulta")
foreach ($g in $grupos) {
    if (-not (Get-ADGroup -Filter "Name -eq '$g'" -ErrorAction SilentlyContinue)) {
        New-ADGroup -Name $g -GroupScope Global -GroupCategory Security -Path $ouGrupos -Description "Rol de Tiquetera Nube"
    }
}

$usuarios = @(
    @{ Sam = "u.admin";       Nombre = "Ana";    Apellido = "Administradora"; Grupos = @("GG-TQ-Admin");                     Habilitado = $true },
    @{ Sam = "u.operador";    Nombre = "Omar";   Apellido = "Operador";       Grupos = @("GG-TQ-Operador");                  Habilitado = $true },
    @{ Sam = "u.usuario";     Nombre = "Ursula"; Apellido = "Usuaria";        Grupos = @("GG-TQ-Usuario");                   Habilitado = $true },
    @{ Sam = "u.consulta";    Nombre = "Carlos"; Apellido = "Consulta";       Grupos = @("GG-TQ-Consulta");                  Habilitado = $true },
    @{ Sam = "u.multi";       Nombre = "Mara";   Apellido = "Multirol";       Grupos = @("GG-TQ-Usuario", "GG-TQ-Operador"); Habilitado = $true },
    @{ Sam = "u.sinrol";      Nombre = "Sergio"; Apellido = "Sinrol";         Grupos = @();                                  Habilitado = $true },
    @{ Sam = "u.deshabilitado"; Nombre = "Diego"; Apellido = "Deshabilitado"; Grupos = @("GG-TQ-Usuario");                   Habilitado = $false }
)

foreach ($u in $usuarios) {
    if (-not (Get-ADUser -Filter "SamAccountName -eq '$($u.Sam)'" -ErrorAction SilentlyContinue)) {
        New-ADUser `
            -SamAccountName $u.Sam `
            -UserPrincipalName "$($u.Sam)@$SufijoUPN" `
            -Name "$($u.Nombre) $($u.Apellido)" `
            -GivenName $u.Nombre `
            -Surname $u.Apellido `
            -DisplayName "$($u.Nombre) $($u.Apellido)" `
            -EmailAddress "$($u.Sam)@$SufijoUPN" `
            -Path $ouUsuarios `
            -AccountPassword $claveLab `
            -PasswordNeverExpires $true `
            -Enabled $u.Habilitado
    }
    foreach ($g in $u.Grupos) { Add-ADGroupMember -Identity $g -Members $u.Sam }
}

if (-not (Get-ADUser -Filter "SamAccountName -eq 'svc-tiquetera'" -ErrorAction SilentlyContinue)) {
    New-ADUser `
        -SamAccountName "svc-tiquetera" `
        -UserPrincipalName "svc-tiquetera@$SufijoUPN" `
        -Name "svc-tiquetera" `
        -Description "Cuenta de servicio de solo lectura para Tiquetera Nube" `
        -Path $ouServicios `
        -AccountPassword $claveServicio `
        -PasswordNeverExpires $true `
        -CannotChangePassword $true `
        -Enabled $true
}

Write-Host "`nDirectorio poblado:" -ForegroundColor Green
Get-ADUser -Filter * -SearchBase $ouRaiz -Properties MemberOf, Enabled |
    Select-Object SamAccountName, Enabled, @{ n = "Grupos"; e = { ($_.MemberOf | ForEach-Object { ($_ -split ",")[0] -replace "CN=" }) -join ", " } } |
    Format-Table -AutoSize
