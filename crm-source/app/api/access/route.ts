import { pinOnlyEnabled, pinOnlyReady } from "../../pin-only";
import { env } from "cloudflare:workers";
import { createPinSession, pinCookieName, pinSessionMaxAge } from "../../pin-auth";

export const dynamic = "force-dynamic";
const failures = new Map<string, { count: number; resetAt: number }>();

export async function POST(request: Request) {
  if (pinOnlyEnabled() && !pinOnlyReady()) {
    return Response.json({ error: "Acceso pendiente de configuración." }, { status: 503 });
  }
  const address = request.headers.get("cf-connecting-ip") || "unknown";
  const now = Date.now();
  const record = failures.get(address);
  if (record && record.resetAt > now && record.count >= 6) {
    return Response.json({ error: "Demasiados intentos. Espera 15 minutos." }, { status: 429, headers: { "Cache-Control": "no-store" } });
  }

  try {
    const body = await request.json() as { pin?: unknown };
    const configuredPin = (env as unknown as Record<string, string | undefined>).CRM_ACCESS_PIN;
    const suppliedPin = typeof body.pin === "string" ? body.pin : "";
    if (!configuredPin) return Response.json({ error: "El acceso PIN aún no está configurado." }, { status: 503 });
    const [expected, supplied] = await Promise.all([
      crypto.subtle.digest("SHA-256", new TextEncoder().encode(configuredPin)),
      crypto.subtle.digest("SHA-256", new TextEncoder().encode(suppliedPin)),
    ]);
    const a = new Uint8Array(expected); const b = new Uint8Array(supplied);
    let different = 0;
    for (let i = 0; i < a.length; i++) different |= a[i] ^ b[i];
    if (different !== 0) {
      const current = record && record.resetAt > now ? record : { count: 0, resetAt: now + 15 * 60 * 1000 };
      current.count += 1;
      failures.set(address, current);
      return Response.json({ error: "PIN incorrecto." }, { status: 401, headers: { "Cache-Control": "no-store" } });
    }
    failures.delete(address);
    const session = await createPinSession();
    return Response.json({ ok: true }, {
      headers: {
        "Cache-Control": "no-store",
        "Set-Cookie": `${pinCookieName}=${session}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${pinSessionMaxAge}`,
      },
    });
  } catch {
    return Response.json({ error: "No se pudo validar el acceso." }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }
}

export async function DELETE() {
  return Response.json({ ok: true }, {
    headers: {
      "Cache-Control": "no-store",
      "Set-Cookie": `${pinCookieName}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT`,
    },
  });
}
