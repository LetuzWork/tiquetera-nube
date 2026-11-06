# Tiquetera Nube

Ticketera de soporte con autenticación contra Active Directory, roles por grupos de AD, restricción horaria de acceso, persistencia en JSON y exportación CSV.

| Documento | Contenido |
|---|---|
| [CONSIGNA.md](CONSIGNA.md) | enunciado del TP y requisitos agregados |
| [docs/PLAN.md](docs/PLAN.md) | arquitectura SOLID, dominio, permisos, API, seguridad, fases |
| [docs/DISENO.md](docs/DISENO.md) | identidad visual "Talonario": paleta, tipografía, componentes |
| [docs/AD_SETUP.md](docs/AD_SETUP.md) | laboratorio de AD en VirtualBox |

## Puesta en marcha

Todo junto, desde la raíz:

```powershell
copy backend\.env.example backend\.env
copy backend\mock_users.example.json backend\mock_users.json
copy frontend\.env.example frontend\.env
npm run setup
npm run dev
```

`npm run dev` levanta backend (prefijo `BE`) y frontend (prefijo `FE`) en la misma terminal; si uno cae, se detienen ambos.

Por separado, backend:

```powershell
cd backend
copy .env.example .env
copy mock_users.example.json mock_users.json
pipenv install --dev
pipenv run seed
pipenv run dev
```

Frontend:

```powershell
cd frontend
copy .env.example .env
npm install
npm run dev
```

App en `http://localhost:5173`, API en `http://localhost:8000/api`, OpenAPI en `http://localhost:8000/docs`.

Para autenticar contra el AD real cambiar `AUTH_PROVIDER=ldap` y completar las variables `LDAP_*` según `docs/AD_SETUP.md`.
