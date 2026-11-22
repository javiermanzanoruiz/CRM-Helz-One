# Importación v22 y ejecución local

El código se importa del ZIP `helzone-crm-source-v22.zip`. El `index.html`
de la raíz sigue siendo la página de acceso, sin cambios. Esta importación no
publica el CRM ni modifica su servicio o base de datos de producción.
Se ha retirado `project_id` de `.openai/hosting.json` para desacoplar esta copia
del proyecto alojado. Se conserva el binding lógico `DB`.

## Configuración pendiente

- Node.js >=22.13 (validado con 24.22.3) y dependencias del lockfile.
- Crear `crm-source/.dev.vars`, ignorado por Git, a partir de `.env.example`,
  sustituyendo los cuatro marcadores por valores exclusivos de desarrollo:
  `CRM_ACCESS_PIN`, `CRM_PHYSIO_PIN`, `CRM_PODOLOGY_PIN` y
  `CRM_SESSION_SECRET` (secreto aleatorio largo). No reutilizar secretos reales.
  La aplicación lee bindings de Workers; un `.env` por sí solo no garantiza
  que estén disponibles en `cloudflare:workers`.
- Inicializar las nueve migraciones `drizzle/0000_*.sql` a `0008_*.sql`,
  en orden, en D1 **local** con binding `DB`. Vite ya configura una base local
  con ID de marcador; no hace falta una cuenta Cloudflare para la emulación.
  Se aplicaron las nueve migraciones solo a una D1 local temporal vacía;
  no se importaron registros ni se contactó con D1 remota.
- No habilitar un destino remoto: cualquier entorno compartido futuro necesita
  su propia D1 vacía, secretos y configuración de hosting, revisados aparte.

Desde `crm-source/`:

```sh
npm run install:ci
npm run build
npm run dev -- --host 127.0.0.1
```

El servidor de desarrollo usa el puerto 5173. La persistencia local de Workers
queda en `.wrangler/`, excluida de Git. La configuración portable incluye un
usuario simulado de Sites (`sites.test`): no valida autenticación real de Sites
ni debe exponerse como servidor público. El acceso por PIN necesita las variables
anteriores; las cookies de sesión llevan `Secure` y requieren un contexto local
compatible o HTTPS.

## Validación tras las correcciones

- `npx tsc --noEmit --incremental false`: sin errores.
- `npm run lint -- --max-warnings 0`: sin errores ni advertencias.
- `npm run build`: correcto.
- `node --experimental-strip-types --test tests/api-response.test.mjs`:
  cuatro pruebas correctas (JSON válido, error de API, error mal formado y no JSON).
- Workers compilado ejecutado en loopback, puerto 8787; `/` y `/profesionales`
  responden 200; ambas APIs de datos sin autenticar responden 401.
- Nueve migraciones aplicadas mediante Wrangler `--local` sobre una D1 temporal
  en `/tmp/helzone-d1-review`; `/api/crm` devuelve diez colecciones vacías.
  Se simuló la cabecera de identidad de Sites únicamente en loopback con una
  identidad de prueba, sin PIN ni secretos. No valida el login real de Sites ni
  las sesiones por PIN. Las tablas permanecieron vacías tras las peticiones.
- El `index.html` raíz y el lockfile permanecen intactos.

Para repetir la prueba del paquete compilado en una base nueva (desde `crm-source`):

```sh
npm run build
review_state=$(mktemp -d /tmp/helzone-d1.XXXXXX)
review_sql=$(mktemp /tmp/helzone-schema.XXXXXX.sql)
cat drizzle/0*.sql > "$review_sql"
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to "$review_state" --file "$review_sql"
mkdir -p .sites-runtime/xdg-config
XDG_CONFIG_HOME="$PWD/.sites-runtime/xdg-config" node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js dev --config dist/server/wrangler.json --local --persist-to "$review_state" --ip 127.0.0.1 --port 8787 --inspector-port 0
```

Esta prueba usa un directorio temporal nuevo; no aplicar de nuevo el SQL completo
sobre una base ya inicializada. El servidor de `npm run dev` tiene su propio
estado local; inicializar esa base aparte si se necesita el flujo de desarrollo.

## Hallazgo que revisar antes de conectar datos

`app/api/crm/route.ts` llama a `deleteProvisionalOctoberClients` desde `GET`.
Para el propietario `helzone-javier`, borra clientes con ID `oct26-client-%`,
registros asociados y transacciones `oct26-payment-%`. Se conserva el código
importado para revisión; no se ejecutó contra datos reales. Además, ese GET puede
crear cuotas mensuales. No usar una base real para probar esta copia.

También `DELETE /api/crm` elimina definitivamente un cliente, sus checkins,
tareas, valoraciones Tanita, notas profesionales y cuotas; conserva los movimientos
de caja, pero pone su `clientId` a null. Son varias operaciones sin una transacción
que garantice que se completen todas juntas. El frontend pide confirmación, pero
la API no añade una segunda confirmación. No se invocó este borrado en la validación.

Las dos rutinas se conservan para revisión; corregir tipos y lint no implica que
sean seguras para producción. Revisar y retirar o aislar la limpieza automática
antes de conectar datos reales. No se han modificado las reglas de negocio.

## Conexión de la aplicación real (pendiente, no ejecutada)

Se necesita un destino Workers/Sites autorizado y su binding `DB` apuntando a la
D1 correcta (el ID actual es un marcador local), los cuatro secretos del apartado
anterior en el gestor seguro del destino, y HTTPS/dominio y configuración de
hosting. Si se usa Sites, restaurar deliberadamente su identidad de proyecto en
la configuración de ese destino. GitHub Pages no ejecuta este backend.

Para una D1 existente, comprobar su historial de migraciones y hacer copia de
seguridad antes de planificar cambios; no aplicar todas las migraciones a ciegas.
Si se admite acceso mediante cabeceras `oai-authenticated-user-*`, el gateway debe
validarlas e impedir que un visitante las falsifique: el código confía en ellas.
El usuario simulado de desarrollo no sustituye esta configuración. Quedan por
validar los inicios de sesión reales por PIN y por Sites, con acceso autorizado.

