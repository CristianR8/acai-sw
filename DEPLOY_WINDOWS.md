# Despliegue en Windows (Frontend + Backend + Base de datos)

Este proyecto ya quedó preparado para desplegarse en una sola máquina Windows con Docker Desktop.

## 1) Requisitos

- Windows 10/11
- Docker Desktop instalado y corriendo
- Git

## 2) Primera instalación

Desde PowerShell en la raíz del proyecto:

```powershell
.\deploy\windows\start.ps1
```

Ese script:
- crea `.env` desde `.env.deploy.example` (si no existe),
- construye imágenes,
- levanta `frontend`, `backend` y `postgres`.

Luego abre:
- Frontend: `http://localhost:3000`
- Backend: `http://localhost:8000`

## 3) Configuración obligatoria

Edita `.env` y ajusta al menos:

- `POSTGRES_PASSWORD`
- Credenciales Factus (`FACTUS_CLIENT_ID`, `FACTUS_CLIENT_SECRET`, etc.)

Aplica cambios:

```powershell
docker compose up -d --build
```

## 4) Operación diaria

- Arrancar: `docker compose up -d`
- Detener: `.\deploy\windows\stop.ps1`
- Ver logs backend: `docker compose logs -f backend`
- Ver logs frontend: `docker compose logs -f frontend`
- Ver logs db: `docker compose logs -f db`

## 5) Actualizaciones de app

```powershell
.\deploy\windows\update.ps1
```

## 6) Backup y restore de base de datos

Backup:

```powershell
docker compose exec db pg_dump -U $env:POSTGRES_USER $env:POSTGRES_DB > backup.sql
```

Restore:

```powershell
Get-Content .\backup.sql | docker compose exec -T db psql -U $env:POSTGRES_USER -d $env:POSTGRES_DB
```

## 7) Empaquetar como "desplegable"

La forma práctica es distribuir:
- código del repo,
- Docker Desktop como prerequisito,
- y scripts `deploy/windows/*.ps1`.

Si quieres un instalador `.exe` real (wizard), usa Inno Setup para:
- copiar el proyecto,
- instalar acceso directo,
- ejecutar `start.ps1` al final.

