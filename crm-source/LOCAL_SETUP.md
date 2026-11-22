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
  No se han aplicado migraciones sobre D1 ni importado registros en esta tarea.
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

## Validación de la importación

- Instalación con lockfile y build completados.
- HTTP local: `/` y `/profesionales` responden 200; `/api/access` responde
  503 al faltar el PIN, como espera el código. No se validó una sesión completa.
- Las nueve migraciones se ejecutaron en SQLite en memoria: diez tablas, todas
  vacías. Esto comprueba el SQL, no sustituye la inicialización de D1 local.
- TypeScript: 12 errores preexistentes (falta `professionalNotes` en `emptyData`,
  respuestas JSON tipadas como `unknown` y un `string | undefined`).
- ESLint: tres errores `react-hooks/set-state-in-effect` y dos advertencias.
- No hay suite de tests declarada. La compilación no sustituye el control de tipos.
- Se revisaron el inventario, patrones de credenciales, correos y SQL: no se
  encontraron exportaciones ni credenciales reales; el correo hallado es el
  usuario simulado `sites.test`. Las migraciones solo contienen esquema.

## Hallazgo que revisar antes de conectar datos

`app/api/crm/route.ts` llama a `deleteProvisionalOctoberClients` desde `GET`.
Para el propietario `helzone-javier`, borra clientes con ID `oct26-client-%`,
registros asociados y transacciones `oct26-payment-%`. Se conserva el código
importado para revisión; no se ejecutó contra datos reales. Además, ese GET puede
crear cuotas mensuales. No usar una base real para probar esta copia.

Los fallos de tipos/lint y este comportamiento deben revisarse antes de considerar
el CRM listo para publicación. No se han modificado las reglas de negocio.
