import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const archivo = resolve(process.argv[2] ?? "backend/mock_users.example.json");
const usuarios = JSON.parse(readFileSync(archivo, "utf8"));

const comillas = (texto) => `'${texto.replaceAll("'", "''")}'`;

const lineas = [];
for (const { usuario, password } of usuarios) {
  lineas.push(
    `try { Set-ADAccountPassword ${comillas(usuario)} -Reset -NewPassword (ConvertTo-SecureString ${comillas(password)} -AsPlainText -Force); ` +
      `Unlock-ADAccount ${comillas(usuario)}; 'ok    ${usuario}' } catch { 'ERROR ${usuario}: ' + $_.Exception.Message }`,
  );
}

const script = join(tmpdir(), `claves-mock-${process.pid}.ps1`);
writeFileSync(script, lineas.join("\n"), "utf8");

console.log(`Cambiando la clave de ${usuarios.length} usuarios desde ${archivo}`);
try {
  const salida = execSync(
    `az vm run-command invoke -g rg-tps-nube -n srv-ad --command-id RunPowerShellScript --scripts "@${script}" --query "value[0].message" -o tsv`,
    { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] },
  );
  console.log(salida.trim());
} finally {
  rmSync(script, { force: true });
}
