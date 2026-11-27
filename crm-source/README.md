# HELZ-ONE CRM

Repositorio de código fuente del CRM de HELZ-ONE. Esta copia corresponde a la versión 22 publicada el 22 de noviembre de 2026.

## Estado y arquitectura

- Aplicación: Next.js/Vinext en Cloudflare Workers.
- Base de datos: Cloudflare D1 con Drizzle; el esquema y todas las migraciones están en `db/` y `drizzle/`.
- Aplicación operativa actual: https://helzone-crm-javier.involucion.chatgpt.site
- El proyecto de producción continúa alojado en Sites y conserva su D1. GitHub es el repositorio del código; GitHub Pages por sí solo no ejecuta las rutas de servidor ni conecta D1.

## Incluye

- CRM completo y área profesional independiente para Fisioterapia y Podología.
- Fichas de clientes, notas, pagos mensuales, caja, venta cruzada, suplementación y valoraciones Tanita.
- API, autenticación por PIN, gestión de sesiones, componentes de interfaz y recursos de compilación.
- Esquema Drizzle, historial de migraciones y manifiesto de conexión del proyecto.

## Datos y accesos

Este repositorio no contiene exportaciones de clientes, información clínica o financiera ni valores reales de PIN. El archivo auxiliar con pagos históricos de octubre se excluyó de esta copia: no forma parte de la aplicación y el nuevo CRM parte de una base limpia. Los datos que ya existan siguen en la base D1 de producción; no se han movido ni borrado.

Los accesos se leen desde variables de entorno: `CRM_ACCESS_PIN`, `CRM_PHYSIO_PIN`, `CRM_PODOLOGY_PIN` y `CRM_SESSION_SECRET`. Los valores reales permanecen como secretos de la configuración de producción. Usa `.env.example` solo como plantilla; no guardes valores reales en GitHub.

## Desarrollo local

Requisitos: Node.js 22.13 o superior.

```bash
npm run install:ci
npm run dev
```

Para generar el paquete de producción: `npm run build`. Para cambios de esquema, genera migraciones con `npm run db:generate` y revisa los SQL antes de aplicarlos. No ejecutes migraciones de producción desde una copia local sin comprobar el destino D1.

## Integración en CRM-Helz-One

Consulta [LOCAL_SETUP.md](LOCAL_SETUP.md) para la configuración local pendiente,
las comprobaciones de esta importación y los fallos detectados. La descripción
anterior procede del adjunto y no certifica el estado del servicio de producción.
