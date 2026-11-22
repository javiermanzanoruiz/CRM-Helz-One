# HELZ-ONE CRM: rama Cloudflare Access

Versión de desarrollo del CRM importado de v22, con cuentas Google individuales
mediante Cloudflare Access. No modifica ni despliega la aplicación publicada.
El `index.html` de la raíz del repositorio conserva la página de acceso actual.

El administrador accede al CRM completo. Fisioterapia y podología solo acceden a
fichas asignadas y anotaciones de su área. Los roles y las asignaciones por correo
se configuran fuera del repositorio. Se conserva el propietario `helzone-javier`.

Consulta [LOCAL_SETUP.md](LOCAL_SETUP.md) para instalación y pruebas locales, y
[docs/CLOUDFLARE_ACCESS.md](docs/CLOUDFLARE_ACCESS.md) para la revisión del Worker y
la configuración pendiente en Cloudflare y Google. No se incluyen datos reales,
secretos ni configuración de cuentas reales. GitHub Pages no ejecuta este backend.
