# Instalacion nativa Windows (sin Docker)

Este flujo instala la app en un PC cliente con:
- Frontend Next.js en puerto 3000
- Backend FastAPI en puerto 8000
- PostgreSQL local en puerto 5432

El acceso directo **ACAIPARK POS** arranca servicios automaticamente (DB + backend + frontend) y abre la app cuando ya esta lista.

## 0) Requisitos

Instalar en Windows (PowerShell como administrador):

```powershell
winget install -e --id OpenJS.NodeJS.LTS
winget install -e --id Python.Python.3.12
winget install -e --id PostgreSQL.PostgreSQL
```

Reiniciar PowerShell y validar:

```powershell
node -v
npm -v
python --version
psql --version
```

## 1) Copiar proyecto al PC cliente

Ruta recomendada:

```text
C:\acaipark-sw
```

## 2) Crear usuario/base de datos en PostgreSQL

Desde `C:\acaipark-sw`:

```powershell
.\deploy\windows-native\create-postgres-db.ps1 -AdminUser postgres -NewUser acai_user -NewPassword "TU_PASSWORD" -NewDatabase acai_prod
```

## 3) Instalar app (backend + frontend)

```powershell
.\deploy\windows-native\setup-native.ps1 -ProjectRoot "C:\acaipark-sw" -PgUser acai_user -PgPassword "TU_PASSWORD" -PgDatabase acai_prod
```

Eso hace:
- crea `acaipark-back\.venv`
- instala `requirements.txt`
- crea `acaipark-back\.env`
- instala dependencias frontend
- compila Next.js (`npm run build`)

## 4) Configurar variables sensibles

Editar:
- `C:\acaipark-sw\acaipark-back\.env`

Configurar al menos:
- `FACTUS_CLIENT_ID`
- `FACTUS_CLIENT_SECRET`
- `FACTUS_USERNAME`
- `FACTUS_PASSWORD`

Si cambias `.env`, reinicia servicios (paso 6).

## 5) Registrar autoarranque al iniciar sesion

```powershell
.\deploy\windows-native\register-startup-tasks.ps1 -ProjectRoot "C:\acaipark-sw" -RunAsUser "$env:USERNAME"
```

## 6) Operacion diaria

Modo recomendado para cliente:
- Hacer doble click en el icono de escritorio **ACAIPARK POS**.
- El launcher valida PostgreSQL, arranca backend/frontend y abre `http://localhost:3000` cuando responde.

Arranque manual (soporte tecnico):

```powershell
.\deploy\windows-native\start-all.ps1 -ProjectRoot "C:\acaipark-sw"
```

Detener:

```powershell
.\deploy\windows-native\stop-all.ps1
```

Logs:
- `%LOCALAPPDATA%\AcaiPark\logs\backend.log`
- `%LOCALAPPDATA%\AcaiPark\logs\frontend.log`

URLs:
- App: `http://localhost:3000`
- API: `http://localhost:8000`

## 7) Actualizacion de version

```powershell
cd C:\acaipark-sw
git pull
.\deploy\windows-native\setup-native.ps1 -ProjectRoot "C:\acaipark-sw" -PgUser acai_user -PgPassword "TU_PASSWORD" -PgDatabase acai_prod
.\deploy\windows-native\start-all.ps1 -ProjectRoot "C:\acaipark-sw"
```

## 8) Backup base de datos

Backup:

```powershell
pg_dump -h 127.0.0.1 -p 5432 -U acai_user -d acai_prod > C:\acaipark-sw\backup.sql
```

Restore:

```powershell
psql -h 127.0.0.1 -p 5432 -U acai_user -d acai_prod -f C:\acaipark-sw\backup.sql
```

## 9) Instalador visual .exe con icono (Inno Setup)

Si no quieres instalar manualmente con scripts, puedes generar un instalador con asistente visual.

### 9.1 Instalar Inno Setup (equipo de empaquetado)

```powershell
winget install -e --id JRSoftware.InnoSetup
```

### 9.2 Generar el .exe

1. Abrir Inno Setup.
2. Abrir archivo `deploy\windows-native\installer\AcaiParkInstaller.iss`.
3. Compilar (`Build -> Compile`).
4. Se genera `AcaiParkSetup.exe` dentro de `deploy\windows-native\installer\`.

### 9.3 En el PC del cliente

1. Ejecutar `AcaiParkSetup.exe` como administrador.
2. Seguir asistente (instala archivos y crea icono de escritorio por defecto).
3. Al final, se ejecuta instalacion asistida (`quick-install.ps1`) para configurar DB/servicios y abrir la app.
4. En uso diario, abrir con el icono de escritorio "ACAIPARK POS".
