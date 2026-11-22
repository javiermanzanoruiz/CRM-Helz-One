export const dynamic = "force-dynamic";
const retired = () => Response.json({ error: "Utiliza Cloudflare Access para iniciar sesión." }, { status: 410, headers: { "Cache-Control": "no-store" } });
export const POST = retired;
export const DELETE = retired;
