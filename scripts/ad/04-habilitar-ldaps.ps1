param(
    [string]$NombreCA = "Tiquetera-Root-CA",
    [string]$Salida = "C:\tiquetera"
)

$ErrorActionPreference = "Stop"

if (-not (Get-WindowsFeature ADCS-Cert-Authority).Installed) {
    Install-WindowsFeature ADCS-Cert-Authority -IncludeManagementTools | Out-Null
    Install-AdcsCertificationAuthority -CAType EnterpriseRootCA -CACommonName $NombreCA -KeyLength 2048 -HashAlgorithmName SHA256 -ValidityPeriod Years -ValidityPeriodUnits 5 -Force | Out-Null
}

certutil -pulse | Out-Null
Start-Sleep -Seconds 10

$fqdn = "$env:COMPUTERNAME.$env:USERDNSDOMAIN".ToLower()
$certDC = Get-ChildItem Cert:\LocalMachine\My | Where-Object {
    $_.DnsNameList.Unicode -contains $fqdn -and $_.EnhancedKeyUsageList.ObjectId -contains "1.3.6.1.5.5.7.3.1"
} | Select-Object -First 1

if (-not $certDC) {
    Write-Warning "Todavía no hay certificado de servidor para $fqdn. Reiniciá el DC y volvé a correr este script."
    return
}

New-Item -ItemType Directory -Force -Path $Salida | Out-Null
certutil -ca.cert "$Salida\ad-ca.cer" | Out-Null
certutil -f -encode "$Salida\ad-ca.cer" "$Salida\ad-ca.pem" | Out-Null

Write-Host "Certificado del DC: $($certDC.Subject) (vence $($certDC.NotAfter))" -ForegroundColor Green
Write-Host "CA exportada en $Salida\ad-ca.pem -> copiala a backend\certs\ad-ca.pem" -ForegroundColor Green
Test-NetConnection -ComputerName localhost -Port 636 | Select-Object ComputerName, RemotePort, TcpTestSucceeded
