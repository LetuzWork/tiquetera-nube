param(
    [string]$Dominio = "tiquetera.local",
    [string]$NetBIOS = "TIQUETERA"
)

$ErrorActionPreference = "Stop"

$dsrm = Read-Host -AsSecureString "Contraseña de modo de restauración (DSRM)"

Install-WindowsFeature AD-Domain-Services -IncludeManagementTools | Out-Null

Install-ADDSForest `
    -DomainName $Dominio `
    -DomainNetbiosName $NetBIOS `
    -ForestMode WinThreshold `
    -DomainMode WinThreshold `
    -InstallDns `
    -SafeModeAdministratorPassword $dsrm `
    -Force
