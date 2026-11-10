#!/usr/bin/env bash
set -euo pipefail

RG="${RG:-rg-tps-nube}"
VM="${VM:-srv-ad}"
NSG="${NSG:-srv-adNSG}"
MI_IP="${1:-$(curl -s https://api.ipify.org)}"
DIR="$(cd "$(dirname "$0")" && pwd)"
SALIDA="$HOME/tiquetera-salida"
mkdir -p "$SALIDA"

correr() {
  az vm run-command invoke -g "$RG" -n "$VM" --command-id RunPowerShellScript --scripts "@$1" --query "value[].message" -o tsv
}

echo "Arrancando $VM si estaba apagada"
az vm start -g "$RG" -n "$VM" -o none

echo "Abriendo el puerto 636 (LDAPS) solo para $MI_IP"
az network nsg rule create -g "$RG" --nsg-name "$NSG" -n LDAPS-mi-ip --priority 1010 \
  --direction Inbound --access Allow --protocol Tcp \
  --source-address-prefixes "$MI_IP" --destination-port-ranges 636 -o none

echo "Creando OUs, grupos, usuarios de prueba y svc-tiquetera"
sed -e 's/DC=tiquetera,DC=local/DC=tpsnube,DC=local/' \
    -e 's/"tiquetera.local"/"tpsnube.local"/' \
    -e 's/\[switch\]\$GenerarClaves/[switch]$GenerarClaves = $true/' \
    "$DIR/../ad/03-poblar-directorio.ps1" > "$SALIDA/03-azure.ps1"
correr "$SALIDA/03-azure.ps1" | tee "$SALIDA/poblar.log"
grep -E '^CLAVE_' "$SALIDA/poblar.log" > "$SALIDA/claves.txt" || true

echo "Habilitando LDAPS con certificado autofirmado"
sed -e 's/\[switch\]\$Autofirmado/[switch]$Autofirmado = $true/' \
    "$DIR/../ad/04-habilitar-ldaps.ps1" > "$SALIDA/04-azure.ps1"
correr "$SALIDA/04-azure.ps1" | tee "$SALIDA/ldaps.log"

printf 'Get-Content C:\\tiquetera\\ad-ca.pem\n' > "$SALIDA/leer-pem.ps1"
correr "$SALIDA/leer-pem.ps1" | sed -n '/-----BEGIN CERTIFICATE-----/,/-----END CERTIFICATE-----/p' > "$SALIDA/ad-ca.pem"

echo
echo "Listo. Descargá desde Administrar archivos:"
echo "  $SALIDA/ad-ca.pem   -> backend/certs/ad-ca.pem"
echo "  $SALIDA/claves.txt  -> las claves van en backend/.env y en credenciales-prueba.local.txt"
