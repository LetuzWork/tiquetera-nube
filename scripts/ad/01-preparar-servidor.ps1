param(
    [string]$NombreEquipo = "DC01",
    [string]$IP = "192.168.56.10",
    [int]$Prefijo = 24,
    [string]$AliasHostOnly = ""
)

$ErrorActionPreference = "Stop"

if (-not $AliasHostOnly) {
    $AliasHostOnly = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -like "192.168.56.*" } | Select-Object -First 1).InterfaceAlias
}
if (-not $AliasHostOnly) { throw "No se encontró la interfaz Host-Only (192.168.56.x). Pasala con -AliasHostOnly." }

Get-NetIPAddress -InterfaceAlias $AliasHostOnly -AddressFamily IPv4 -ErrorAction SilentlyContinue | Remove-NetIPAddress -Confirm:$false
Set-NetIPInterface -InterfaceAlias $AliasHostOnly -Dhcp Disabled
New-NetIPAddress -InterfaceAlias $AliasHostOnly -IPAddress $IP -PrefixLength $Prefijo | Out-Null
Set-DnsClientServerAddress -InterfaceAlias $AliasHostOnly -ServerAddresses "127.0.0.1"

Set-TimeZone -Id "Argentina Standard Time"

if ($env:COMPUTERNAME -ne $NombreEquipo) {
    Rename-Computer -NewName $NombreEquipo -Force
    Write-Host "Equipo renombrado a $NombreEquipo. Reiniciando..."
    Restart-Computer -Force
}
