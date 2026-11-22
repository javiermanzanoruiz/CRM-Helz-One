# Revisión previa de arquitectura y configuración de Access

Revisión realizada antes de cambiar la autenticación:
- `vite.config.ts` fija `worker/index.ts` como entrada del plugin Cloudflare.
- Esa entrada recibe Request/env/context antes de `vinext/server/fetch-handler`.
- El bundle generado conserva ese wrapper. Por tanto puede recibir y verificar
  `Cf-Access-Jwt-Assertion` antes de ejecutar páginas o APIs.
- `nodejs_compat` y AsyncLocalStorage ya se usan para el contexto de conectores;
  permiten transportar identidad verificada sin confiar en cabeceras internas.
- Esto demuestra compatibilidad local del Worker, no que el alojamiento Sites
  publicado permita controlar DNS, Access o el paso de cabeceras. Confirmar esos
  permisos con su operador; si no están disponibles, preparar un destino Workers
  propio separado. No cambiar la app publicada durante esta preparación.

## Configuración que realizará el operador (sin desplegar en esta tarea)

1. Configurar Google como identity provider en Cloudflare Zero Trust: cliente
   OAuth en Google, URI de callback indicada por Cloudflare y credenciales OAuth
   guardadas en Cloudflare, nunca en Git ni en el frontend. Restringir la aplicación
   Access a ese proveedor; no habilitar bypass, OTP alternativo o service tokens.
2. Crear una aplicación Access Self-hosted para el hostname completo del CRM,
   incluyendo `/api/*`, `/profesionales`, RSC y cualquier alias. Añadir políticas
   Allow para las cuentas individuales autorizadas y duración de sesión acotada.
3. Configurar en el Worker `CF_ACCESS_TEAM_DOMAIN` (solo hostname
   `equipo.cloudflareaccess.com`) y `CF_ACCESS_AUD` (Application Audience AUD).
   Permitir salida HTTPS al endpoint `/cdn-cgi/access/certs` de ese equipo.
4. Guardar `CRM_ACCESS_USERS` como JSON en un secreto/binding externo: cada clave
   es el correo de una cuenta y su valor `{ "role": "admin" }` o
   `{ "role": "fisioterapia", "clientIds": ["id-de-ficha"] }` o
   `{ "role": "podologia", "clientIds": ["id-de-ficha"] }`.
   No guardar correos reales en archivos versionados. Las listas profesionales
   son explícitas; una lista vacía no permite consultar ninguna ficha.
5. Mantener el binding D1 `DB` del destino y su propietario administrativo
   `helzone-javier`. No derivar owner_id del email ni del subject de Google/Access.
   El código anterior también consultaba un segundo propietario histórico desde
   el portal profesional: no se migran ni mezclan esos registros automáticamente.
   Confirmar su situación por separado antes de activar la versión real.
6. Proteger o desactivar rutas alternativas como workers.dev, URLs de preview y
   dominios anteriores. El Worker rechaza además peticiones sin JWT válido aunque
   se salten Access. No cachear respuestas privadas en CDN. HTTPS obligatorio.
7. Validar en un entorno separado los tres roles, asignaciones, revocación y
   cierre de sesión de Access. Salir de Access no cierra la cuenta global Google.

La aplicación verifica firma RS256 con las claves públicas del equipo configurado,
issuer exacto, audience, expiración, nbf y tipo de token de usuario. No utiliza
`Cf-Access-Authenticated-User-Email` ni las cabeceras de Sites como autenticación.
El correo del JWT verificado se normaliza y se busca en la configuración externa.
Los antiguos PIN/cookies no habilitan acceso en esta versión.
