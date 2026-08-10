# Despliegue portable de ACAIPARK

Esta guía sirve para levantar el proyecto completo en otro dispositivo usando Docker Compose y un backup de PostgreSQL.

## Qué copiar

- Todo el repositorio.
- El backup de base de datos: `acaipark-back/acaipark_dev.backup`.

## Requisitos

- Docker Desktop instalado y corriendo.
- Git.

## Preparar el entorno

1. Copia `.env.deploy.example` a `.env` en la raíz del repositorio.
2. Ajusta al menos:
   - `POSTGRES_PASSWORD`
   - credenciales de Factus si vas a usar facturación.
3. Levanta la infraestructura:

```bash
docker compose up -d --build
```

4. Restaura la base con el backup incluido:

```bash
./deploy/portable/restore-db.sh acaipark-back/acaipark_dev.backup
```

5. Abre la app:
   - Frontend: `http://localhost:3000`
   - Backend: `http://localhost:8000`

## Scripts incluidos

- `deploy/portable/restore-db.sh`: restaura un backup `.backup` en el contenedor de PostgreSQL.
- `deploy/portable/backup-db.sh`: genera un nuevo backup del contenedor PostgreSQL.

## Flujo normal

### Primera vez

```bash
cp .env.deploy.example .env
docker compose up -d --build
./deploy/portable/restore-db.sh acaipark-back/acaipark_dev.backup
```

### Para generar un respaldo nuevo

```bash
./deploy/portable/backup-db.sh acaipark-back/acaipark_dev.backup
```
