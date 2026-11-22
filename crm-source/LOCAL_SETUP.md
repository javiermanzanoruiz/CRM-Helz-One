# Desarrollo local: Google mediante Cloudflare Access

Rama `feature/cloudflare-access-google`, basada en la corrección de la PR #1.
El `index.html` raíz sigue intacto. No se ha desplegado, cambiado la aplicación
publicada, conectado D1 real ni migrado datos.

## Arquitectura revisada antes de modificar autenticación

[docs/CLOUDFLARE_ACCESS.md](docs/CLOUDFLARE_ACCESS.md) documenta la inspección del
Worker generado y los pasos exactos que debe realizar el operador en Cloudflare.
El wrapper recibe el Request original y verifica Access antes de Vinext. La
identidad se transporta en AsyncLocalStorage, aislada por petición, no en una
cabecera de correo que pueda falsificar el cliente. La prueba de integración
confirma ese recorrido en el paquete compilado.

Se verifica el JWT `Cf-Access-Jwt-Assertion` con `jose`: firma RS256, claves del
endpoint HTTPS del equipo configurado, issuer, audience, exp, iat, nbf cuando
existe, subject, email y tipo de token de usuario. Los permisos se consultan
externamente después de verificar el JWT. No se usan las cabeceras de correo de
Access/Sites sin verificar ni las antiguas cookies/PIN. Los endpoints antiguos
responden 410 y ya no emiten sesiones. La falta de configuración devuelve 503;
la falta de identidad válida, 401; una identidad sin permiso, 403.

## Configuración externa pendiente

- `CF_ACCESS_TEAM_DOMAIN`: hostname del equipo, como `your-team.cloudflareaccess.com`.
- `CF_ACCESS_AUD`: Application Audience del CRM, no el client ID de Google.
- `CRM_ACCESS_USERS`: JSON con correo como clave y `{ "role": "admin" }`,
  `{ "role": "fisioterapia", "clientIds": ["id-de-ficha"] }` o
  `{ "role": "podologia", "clientIds": ["id-de-ficha"] }`. Guardar en un
  binding/secreto de Workers, nunca en Git. La plantilla vacía deniega a todos.
- Google como único proveedor permitido de la aplicación Access; proteger todo
  el hostname y API, sin bypass. Las credenciales OAuth se guardan en Cloudflare.
- Binding `DB`, dominio HTTPS, protección de aliases y rutas workers.dev/preview,
  sin caché compartida de respuestas privadas. Confirmar que el operador de Sites
  permite configurar Access; de lo contrario preparar un Worker separado.

El administrador ve el CRM completo con el owner_id estable `helzone-javier`.
Los profesionales solo ven las fichas asignadas a su cuenta bajo ese propietario,
y las anotaciones de su área. Las notas son compartidas por área para las fichas
asignadas, no privadas por autor. El servidor fija rol y propietario al guardar:
no acepta los del cuerpo de la petición. No expone campos de cuotas/pagos por la
API profesional. No tener asignaciones equivale a no tener acceso a fichas.
El filtro de términos financieros en texto libre es una ayuda heredada, no una
clasificación infalible: no guardar información financiera en campos clínicos.

No se derivan nuevos propietarios de Google ni se reescriben registros. El portal
anterior consultaba también un propietario UUID histórico; esta versión no mezcla
sus datos con el propietario actual. Revisar esa situación por separado antes
de conectar la aplicación real, sin ejecutar migraciones automáticas.

## Instalación y validación sin credenciales reales

Node.js >=22.13; verificado con Node 24.22.3.

```sh
npm run install:ci
npx tsc --noEmit --incremental false
npm run lint -- --max-warnings 0
npm test
npm run build
npm run test:integration
```

`npm test` ejecuta 20 pruebas: validación criptográfica, claims y errores, permisos,
aislamiento concurrente, límites de fichas/áreas, mutaciones y regresión del GET
sin borrado. Las direcciones `example.test` e IDs de las pruebas son simulados.

La integración ejecuta el Worker compilado en Miniflare y crea D1 local efímera
con las nueve migraciones. Genera las claves RSA solo en memoria, simula el JWKS
con fetchMock y bloquea cualquier conexión de red real. Comprueba los tres roles,
páginas, redirecciones, APIs, ausencia de acceso por correo falsificado, ausencia
de caché pública y que D1 sigue vacía. No existe una variable de bypass para
identidades simuladas en el Worker de producción.

`npm run dev -- --host 127.0.0.1` puede usarse para desarrollo, pero sin configuración
Access devolverá 503; no se introduce un login ficticio en el servidor. Para probar
el flujo Google real se requiere un entorno separado protegido por Access y la
configuración anterior. Los valores locales, si fueran necesarios, irían en
`.dev.vars` ignorado por Git. No copiar secretos de producción.

## Operaciones destructivas que siguen requiriendo revisión

Se eliminó `deleteProvisionalOctoberClients` y su llamada desde GET. Consultar el
CRM no borra registros; GET aún puede crear cuotas de clientes activos.

`DELETE /api/crm`, accesible solo al administrador, borra la ficha, checkins,
tareas, valoraciones, notas profesionales y cuotas; conserva movimientos de caja
con clientId nulo. Son varias operaciones sin transacción conjunta. El frontend
pide confirmación. Esta operación se conserva; no se probó contra datos reales.

Antes de activar una conexión real: revisar permisos y asignaciones, confirmar
propietario, backups e historial de migraciones, probar login/revocación/logout
con Google y autorización de cada rol en un entorno separado. La validación local
no certifica que el dominio actual tenga Cloudflare Access configurado.
