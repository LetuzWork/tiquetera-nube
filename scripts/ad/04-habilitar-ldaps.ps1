param(
    [string]$NombreCA = "Tiquetera-Root-CA",
    [string]$Salida = "C:\tiquetera",
    [switch]$Autofirmado
)

$ErrorActionPreference = "Stop"
$fqdn = [System.Net.Dns]::GetHostEntry($env:COMPUTERNAME).HostName.ToLower()
$usoServidor = "1.3.6.1.5.5.7.3.1"
New-Item -ItemType Directory -Force -Path $Salida | Out-Null

function Buscar-CertificadoDC {
    Get-ChildItem Cert:\LocalMachine\My | Where-Object {
        $_.DnsNameList.Unicode -contains $fqdn -and $_.EnhancedKeyUsageList.ObjectId -contains $usoServidor -and $_.NotAfter -gt (Get-Date)
    } | Sort-Object NotAfter -Descending | Select-Object -First 1
}

if ($Autofirmado) {
    $certDC = Buscar-CertificadoDC
    if (-not $certDC -or $certDC.Issuer -ne $certDC.Subject) {
        $certDC = New-SelfSignedCertificate `
            -DnsName $fqdn, $env:COMPUTERNAME.ToLower() `
            -CertStoreLocation Cert:\LocalMachine\My `
            -KeyAlgorithm RSA -KeyLength 2048 -HashAlgorithm SHA256 `
            -KeyUsage DigitalSignature, KeyEncipherment `
            -TextExtension @("2.5.29.37={text}$usoServidor") `
            -NotAfter (Get-Date).AddYears(2) `
            -FriendlyName "LDAPS Tiquetera"
    }
    $raiz = New-Object System.Security.Cryptography.X509Certificates.X509Store("Root", "LocalMachine")
    $raiz.Open("ReadWrite")
    $raiz.Add($certDC)
    $raiz.Close()

    $ldif = "$Salida\renovar-cert.ldf"
    Set-Content -Path $ldif -Encoding ASCII -Value @("dn:", "changetype: modify", "add: renewServerCertificate", "renewServerCertificate: 1", "-", "")
    ldifde -i -f $ldif | Out-Null

    $der = $certDC.Export([System.Security.Cryptography.X509Certificates.X509ContentType]::Cert)
    $b64 = [Convert]::ToBase64String($der, [Base64FormattingOptions]::InsertLineBreaks)
    Set-Content -Path "$Salida\ad-ca.pem" -Encoding ASCII -Value @("-----BEGIN CERTIFICATE-----", $b64, "-----END CERTIFICATE-----")
} else {
    if (-not (Get-WindowsFeature ADCS-Cert-Authority).Installed) {
        Install-WindowsFeature ADCS-Cert-Authority -IncludeManagementTools | Out-Null
        Install-AdcsCertificationAuthority -CAType EnterpriseRootCA -CACommonName $NombreCA -KeyLength 2048 -HashAlgorithmName SHA256 -ValidityPeriod Years -ValidityPeriodUnits 5 -Force | Out-Null
    }
    certutil -pulse | Out-Null
    Start-Sleep -Seconds 10
    $certDC = Buscar-CertificadoDC
    if (-not $certDC) {
        Write-Warning "Todavía no hay certificado de servidor para $fqdn. Reiniciá el DC y volvé a correr este script."
        return
    }
    certutil -ca.cert "$Salida\ad-ca.cer" | Out-Null
    certutil -f -encode "$Salida\ad-ca.cer" "$Salida\ad-ca.pem" | Out-Null
}

Start-Sleep -Seconds 5
Write-Output "Certificado del DC: $($certDC.Subject) (vence $($certDC.NotAfter))"
Write-Output "Certificado exportado en $Salida\ad-ca.pem, va en backend\certs\ad-ca.pem"
Test-NetConnection -ComputerName localhost -Port 636 | Select-Object ComputerName, RemotePort, TcpTestSucceeded | Format-List | Out-String
